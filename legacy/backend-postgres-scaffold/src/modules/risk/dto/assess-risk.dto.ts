import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssessRiskDto {
  @ApiProperty() @IsUUID() patientId: string;

  @ApiProperty({ required: false, description: 'Diagnosis to combine with the clinical record' })
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @ApiProperty({ required: false, description: 'Defaults to the latest record for the patient' })
  @IsOptional()
  @IsUUID()
  clinicalRecordId?: string;
}
