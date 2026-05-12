import { Module } from '@nestjs/common';
import { ServiceSharedService } from './shared.services.service';

@Module({
  providers: [ServiceSharedService],
  exports: [ServiceSharedService],
})
export class SharedServicesModule {}
