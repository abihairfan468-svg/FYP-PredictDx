import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 7.2: patients search chest specialists by specialization and city. */
  search(specialization?: string, city?: string) {
    return this.prisma.doctor.findMany({
      where: {
        isVerified: true,
        ...(specialization && { specialization: { contains: specialization, mode: 'insensitive' } }),
        ...(city && { hospital: { contains: city, mode: 'insensitive' } }),
      },
      include: { user: { select: { fullName: true, email: true } } },
    });
  }
}
