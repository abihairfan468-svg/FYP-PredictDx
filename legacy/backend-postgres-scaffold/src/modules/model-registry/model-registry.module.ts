import { Module } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import { ModelRegistryController } from './model-registry.controller';

@Module({
  controllers: [ModelRegistryController],
  providers: [ModelRegistryService],
  exports: [ModelRegistryService],
})
export class ModelRegistryModule {}
