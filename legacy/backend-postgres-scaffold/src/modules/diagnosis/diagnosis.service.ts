import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Role, VerifyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateStudyDto } from './dto/create-study.dto';
import { VerifyDiagnosisDto } from './dto/verify-diagnosis.dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';

export const DISCLAIMER =
  'AI-generated decision support. Not a clinical diagnosis. Requires review by a qualified physician.';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/dicom'];

@Injectable()
export class DiagnosisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('diagnosis') private readonly queue: Queue,
  ) {}

  /** 1. Validate and store the upload, 2. create the study row, 3. queue the analysis. */
  async createStudy(file: Express.Multer.File, dto: CreateStudyDto, user: JwtUser) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG or DICOM chest X-rays are accepted');
    }
    if (file.size > this.config.get<number>('uploads.maxBytes')) {
      throw new BadRequestException('File is too large');
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const { key, checksum, sizeBytes } = await this.storage.put(
      file.buffer,
      'studies',
      file.originalname,
    );

    // The same image uploaded twice is detected instead of analysed twice.
    const duplicate = await this.prisma.xrayStudy.findUnique({
      where: { checksumSha256: checksum },
      include: { diagnosis: true },
    });
    if (duplicate) {
      await this.storage.remove(key);
      return { studyId: duplicate.id, status: duplicate.status, duplicate: true };
    }

    const study = await this.prisma.xrayStudy.create({
      data: {
        patientId: dto.patientId,
        uploadedById: user.id,
        storageKey: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: sizeBytes,
        checksumSha256: checksum,
        view: dto.view ?? 'PA',
        status: 'QUEUED',
      },
    });

    await this.queue.add(
      'analyse',
      { studyId: study.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100 },
    );

    return { studyId: study.id, status: 'QUEUED', pollAfterMs: 2000 };
  }

  /** Poll endpoint: returns status while processing, the full result when ready. */
  async getStudy(id: string, user: JwtUser) {
    const study = await this.prisma.xrayStudy.findUnique({
      where: { id },
      include: {
        patient: true,
        diagnosis: { include: { modelVersion: true, riskAssessment: true } },
      },
    });
    if (!study) throw new NotFoundException('Study not found');
    await this.assertCanView(study.patient.userId, user);

    if (study.status !== 'COMPLETED' || !study.diagnosis) {
      return { studyId: study.id, status: study.status, failureReason: study.failureReason };
    }

    const d = study.diagnosis;
    return {
      studyId: study.id,
      status: study.status,
      imageUrl: this.storage.signedUrl(study.storageKey),
      result: {
        predictedLabel: d.predictedLabel,
        confidence: Number(d.confidence),
        probabilities: {
          NORMAL: Number(d.probNormal),
          PNEUMONIA: Number(d.probPneumonia),
          TUBERCULOSIS: Number(d.probTb),
        },
        gradcamUrl: d.gradcamKey ? this.storage.signedUrl(d.gradcamKey) : null,
        inferenceMs: d.inferenceMs,
        model: { name: d.modelVersion.name, version: d.modelVersion.version },
      },
      risk: d.riskAssessment
        ? {
            band: d.riskAssessment.riskBand,
            score: Number(d.riskAssessment.riskScore),
            horizonMonths: d.riskAssessment.horizonMonths,
            topFactors: d.riskAssessment.topFactors,
          }
        : null,
      verification: {
        status: d.verifyStatus,
        verifiedLabel: d.verifiedLabel,
        notes: d.doctorNotes,
        verifiedAt: d.verifiedAt,
      },
      disclaimer: DISCLAIMER,
    };
  }

  /** Doctor confirms or corrects the AI. Corrected rows become the retraining set. */
  async verify(diagnosisId: string, dto: VerifyDiagnosisDto, user: JwtUser) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) throw new ForbiddenException('Only a registered doctor can verify a result');

    const diagnosis = await this.prisma.diagnosisResult.findUnique({ where: { id: diagnosisId } });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');

    return this.prisma.diagnosisResult.update({
      where: { id: diagnosisId },
      data: {
        verifiedLabel: dto.verifiedLabel,
        doctorNotes: dto.notes,
        verifiedById: doctor.id,
        verifiedAt: new Date(),
        verifyStatus:
          dto.verifiedLabel === diagnosis.predictedLabel
            ? VerifyStatus.CONFIRMED
            : VerifyStatus.CORRECTED,
      },
    });
  }

  listForPatient(patientId: string) {
    return this.prisma.xrayStudy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { diagnosis: { select: { predictedLabel: true, confidence: true } } },
    });
  }

  /** A patient sees only their own studies; clinical staff see all. */
  private async assertCanView(ownerUserId: string, user: JwtUser) {
    const staff: string[] = [Role.DOCTOR, Role.ADMIN, Role.RADIOLOGIST];
    if (staff.includes(user.role)) return;
    if (ownerUserId !== user.id) throw new ForbiddenException('This record is not yours');
  }
}
