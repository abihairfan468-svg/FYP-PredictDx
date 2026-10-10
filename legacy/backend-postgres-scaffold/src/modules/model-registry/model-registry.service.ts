import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModelRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.modelVersion.findMany({ orderBy: { trainedAt: 'desc' } });
  }

  async getActive() {
    const active = await this.prisma.modelVersion.findFirst({ where: { isActive: true } });
    if (!active) {
      throw new NotFoundException(
        'No active model version. Seed the database or register a trained model first.',
      );
    }
    return active;
  }

  /** Exactly one model is active at a time, so results stay traceable. */
  async activate(id: string) {
    await this.prisma.modelVersion.updateMany({ data: { isActive: false } });
    return this.prisma.modelVersion.update({ where: { id }, data: { isActive: true } });
  }
}
