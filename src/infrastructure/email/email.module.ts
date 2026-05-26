import { Global, Module } from '@nestjs/common';
import { EmailService } from '@src/infrastructure/email/email.service';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from '@src/infrastructure/storage/s3.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EmailService, S3Service],
  exports: [EmailService],
})
export class EmailModule {}
