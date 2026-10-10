import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiseaseLabel } from '@prisma/client';

export class VerifyDiagnosisDto {
  @ApiProperty({ enum: DiseaseLabel, description: 'The label the doctor agrees with' })
  @IsEnum(DiseaseLabel)
  verifiedLabel: DiseaseLabel;

  @ApiProperty({ required: false, example: 'Consistent with upper lobe cavitation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
