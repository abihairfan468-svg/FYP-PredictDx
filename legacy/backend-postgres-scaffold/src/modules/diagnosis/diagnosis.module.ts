import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';
import { DiagnosisProcessor } from './diagnosis.processor';
import { AiClientService } from './ai-client.service';
import { ModelRegistryModule } from '../model-registry/model-registry.module';

@Module({
  imports: [
    HttpModule,
    MulterModule.register({}), // memory storage: the buffer goes straight to StorageService
    BullModule.registerQueue({ name: 'diagnosis' }),
    ModelRegistryModule,
  ],
  controllers: [DiagnosisController],
  providers: [DiagnosisService, DiagnosisProcessor, AiClientService],
  exports: [AiClientService],
})
export class DiagnosisModule {}
