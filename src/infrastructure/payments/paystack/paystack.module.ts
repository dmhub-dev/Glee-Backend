import { Module } from '@nestjs/common';
import { PayStackController } from './paystack.controller';
import { PayStackService } from './paystack.service';

@Module({
  controllers: [PayStackController],
  providers: [PayStackService],
  exports: [PayStackService],
})
export class PaystackModule {}
