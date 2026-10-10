import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DiagnosisService } from './diagnosis.service';
import { CreateStudyDto } from './dto/create-study.dto';
import { VerifyDiagnosisDto } from './dto/verify-diagnosis.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';

@ApiTags('7.4 Smart Diagnosis Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('diagnosis')
export class DiagnosisController {
  constructor(private readonly diagnosis: DiagnosisService) {}

  @Post('studies')
  @Roles(Role.PATIENT, Role.DOCTOR, Role.RADIOLOGIST)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a chest X-ray and queue AI analysis' })
  @UseInterceptors(FileInterceptor('file'))
  createStudy(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateStudyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.diagnosis.createStudy(file, dto, user);
  }

  @Get('studies/:id')
  @ApiOperation({ summary: 'Poll analysis status and fetch the result' })
  getStudy(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.diagnosis.getStudy(id, user);
  }

  @Get('patients/:patientId/studies')
  listForPatient(@Param('patientId') patientId: string) {
    return this.diagnosis.listForPatient(patientId);
  }

  @Patch(':id/verify')
  @Roles(Role.DOCTOR, Role.RADIOLOGIST)
  @ApiOperation({ summary: 'Doctor confirms or corrects the AI prediction' })
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyDiagnosisDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.diagnosis.verify(id, dto, user);
  }
}
