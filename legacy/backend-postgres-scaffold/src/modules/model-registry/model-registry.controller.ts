import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ModelRegistryService } from './model-registry.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('7.4 Smart Diagnosis Center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('models')
export class ModelRegistryController {
  constructor(private readonly models: ModelRegistryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RADIOLOGIST)
  findAll() {
    return this.models.findAll();
  }

  @Get('active')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RADIOLOGIST)
  getActive() {
    return this.models.getActive();
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  activate(@Param('id') id: string) {
    return this.models.activate(id);
  }
}
