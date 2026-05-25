import { Global, Module } from '@nestjs/common';
import { EmailService } from '@src/email-server/email.service';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from '@src/shared/s3.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EmailService, S3Service],
  exports: [EmailService],
})
export class EmailModule {}
