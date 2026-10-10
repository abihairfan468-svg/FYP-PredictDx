import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RiskService } from './risk.service';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('7.4 Smart Diagnosis Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Post('assess')
  @Roles(Role.DOCTOR, Role.RADIOLOGIST)
  @ApiOperation({ summary: 'Combine X-ray probabilities with clinical data into a risk band' })
  assess(@Body() dto: AssessRiskDto) {
    return this.risk.assess(dto);
  }

  @Get('patient/:patientId')
  findForPatient(@Param('patientId') patientId: string) {
    return this.risk.findForPatient(patientId);
  }
}
