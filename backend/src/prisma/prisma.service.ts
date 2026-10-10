import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Database');

  /** PostgreSQL may still be booting when the API starts (npm run dev starts both), so retry briefly. */
  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (e) {
        if (attempt >= 20) throw e;
        if (attempt === 1) this.log.warn('Waiting for PostgreSQL …');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
