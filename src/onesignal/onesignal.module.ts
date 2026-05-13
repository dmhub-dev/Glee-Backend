import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OnesignalController } from './onesignal.controller';
import { OnesignalHttpModule } from './onesignal.provider';
import { OnesignalService } from './onesignal.service';

@Module({
  imports: [HttpModule, OnesignalHttpModule],
  controllers: [OnesignalController],
  providers: [OnesignalService],
  exports: [OnesignalService],
})
export class OnesignalModule {}
