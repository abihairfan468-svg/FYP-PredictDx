import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** The structured half of the multimodal model: clinical features that ride alongside the X-ray. */
export class CreateClinicalRecordDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiProperty({ example: 34 }) @IsInt() @Min(0) @Max(120) age: number;
  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender: Gender;

  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() smoker?: boolean;
  @ApiProperty({ required: false, example: 21 }) @IsOptional() @IsInt() @Min(0) coughDays?: number;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() fever?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() weightLoss?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() nightSweats?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() breathlessness?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() chestPain?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() diabetes?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() hivPositive?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() tbContact?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() priorTb?: boolean;

  @ApiProperty({ required: false, example: 96 }) @IsOptional() @IsInt() @Min(50) @Max(100) spo2?: number;
  @ApiProperty({ required: false, example: 38.4 }) @IsOptional() @IsNumber() temperatureC?: number;
  @ApiProperty({ required: false, example: 21.5 }) @IsOptional() @IsNumber() bmi?: number;
}
