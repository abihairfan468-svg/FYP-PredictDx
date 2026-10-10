import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.patient.findMany({
      include: { user: { select: { fullName: true, email: true } } },
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  /** 7.7 Health Journey Tracker: one timeline of everything about a patient. */
  async history(id: string) {
    const [studies, risks, prescriptions, appointments] = await Promise.all([
      this.prisma.xrayStudy.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
        include: { diagnosis: true },
      }),
      this.prisma.riskAssessment.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.prescription.findMany({ where: { patientId: id }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.appointment.findMany({ where: { patientId: id }, orderBy: { scheduledAt: 'desc' } }),
    ]);
    return { studies, risks, prescriptions, appointments };
  }
}
