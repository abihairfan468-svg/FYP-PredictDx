import { Module } from '@nestjs/common';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { ClinicalRecordsModule } from '../clinical-records/clinical-records.module';

@Module({
  imports: [DiagnosisModule, ClinicalRecordsModule],
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
