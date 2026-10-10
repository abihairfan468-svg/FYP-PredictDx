import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClientService } from '../diagnosis/ai-client.service';
import { ClinicalRecordsService } from '../clinical-records/clinical-records.service';
import { AssessRiskDto } from './dto/assess-risk.dto';

/**
 * Multimodal risk: image probabilities + structured clinical features.
 * Note for the report: this estimates likelihood given current evidence.
 * True longitudinal prediction needs repeat visits per patient over time.
 */
@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly clinical: ClinicalRecordsService,
  ) {}

  async assess(dto: AssessRiskDto) {
    const record = dto.clinicalRecordId
      ? await this.prisma.clinicalRecord.findUnique({ where: { id: dto.clinicalRecordId } })
      : await this.clinical.latestForPatient(dto.patientId);
    if (!record) throw new NotFoundException('Clinical record not found');

    let probabilities = { NORMAL: 1, PNEUMONIA: 0, TUBERCULOSIS: 0 };
    let modelVersionId: string | undefined;

    if (dto.diagnosisId) {
      const d = await this.prisma.diagnosisResult.findUnique({ where: { id: dto.diagnosisId } });
      if (!d) throw new NotFoundException('Diagnosis not found');
      probabilities = {
        NORMAL: Number(d.probNormal),
        PNEUMONIA: Number(d.probPneumonia),
        TUBERCULOSIS: Number(d.probTb),
      };
      modelVersionId = d.modelVersionId;
    }

    const out = await this.ai.risk({
      probabilities,
      clinical: {
        age: record.age,
        smoker: record.smoker,
        coughDays: record.coughDays ?? 0,
        fever: record.fever,
        weightLoss: record.weightLoss,
        nightSweats: record.nightSweats,
        breathlessness: record.breathlessness,
        diabetes: record.diabetes,
        hivPositive: record.hivPositive,
        tbContact: record.tbContact,
        priorTb: record.priorTb,
        spo2: record.spo2 ?? 98,
      },
    });

    return this.prisma.riskAssessment.create({
      data: {
        patientId: dto.patientId,
        diagnosisId: dto.diagnosisId,
        clinicalRecordId: record.id,
        riskScore: out.riskScore,
        riskBand: out.riskBand,
        horizonMonths: out.horizonMonths,
        topFactors: out.topFactors,
        modelVersionId,
      },
    });
  }

  findForPatient(patientId: string) {
    return this.prisma.riskAssessment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
