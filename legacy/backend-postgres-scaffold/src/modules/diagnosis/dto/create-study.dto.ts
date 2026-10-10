import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateStudyDto {
  @ApiProperty({ description: 'Patient the X-ray belongs to' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ required: false, enum: ['PA', 'AP', 'LATERAL'], default: 'PA' })
  @IsOptional()
  @IsIn(['PA', 'AP', 'LATERAL'])
  view?: string;
}
