import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClinicalRecordsService } from './clinical-records.service';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('7.4 Smart Diagnosis Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clinical-records')
export class ClinicalRecordsController {
  constructor(private readonly records: ClinicalRecordsService) {}

  @Post()
  @Roles(Role.DOCTOR, Role.PATIENT, Role.RADIOLOGIST)
  create(@Body() dto: CreateClinicalRecordDto) {
    return this.records.create(dto);
  }

  @Get('patient/:patientId')
  findForPatient(@Param('patientId') patientId: string) {
    return this.records.findForPatient(patientId);
  }
}
