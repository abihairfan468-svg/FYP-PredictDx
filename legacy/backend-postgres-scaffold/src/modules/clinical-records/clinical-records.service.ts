import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';

@Injectable()
export class ClinicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClinicalRecordDto) {
    return this.prisma.clinicalRecord.create({ data: dto });
  }

  findForPatient(patientId: string) {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async latestForPatient(patientId: string) {
    const record = await this.prisma.clinicalRecord.findFirst({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!record) throw new NotFoundException('No clinical record for this patient yet');
    return record;
  }
}
