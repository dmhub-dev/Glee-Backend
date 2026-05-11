import { Global, Module } from '@nestjs/common';
import { EmailService } from '@src/email-server/email.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
