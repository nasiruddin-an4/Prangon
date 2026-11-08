import { Module } from '@nestjs/common';
import { InstitutionController, PlatformInstitutionsController } from './institutions.controller.js';
import { InstitutionsService } from './institutions.service.js';

@Module({
  controllers: [PlatformInstitutionsController, InstitutionController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
