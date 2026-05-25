import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from '@src/shared/s3.service';

export interface EmailAttachment {
  filename: string;
  content?: Buffer;
  content_type?: string;
  path?: string;
  cid?: string;
}

export interface SendMailOptions {
  template: string
  message: {
    to: string | string[]
    subject: string
    attachments?: EmailAttachment[]
  }
  locals: Record<string, unknown>
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private logoUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
  ) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('RESEND_FROM') ?? 'Glee <tickets@gleefolder.com>';
  }

  async onModuleInit() {
    try {
      const logoPath = path.join(process.cwd(), 'views', 'logo.svg');
      const logoBuffer = fs.readFileSync(logoPath);
      this.logoUrl = await this.s3.uploadBuffer(logoBuffer, 'static/logo.svg', 'image/svg+xml');
      this.logger.log(`Logo uploaded: ${this.logoUrl}`);
    } catch (err) {
      this.logger.warn(`Logo S3 upload failed, email logo will be broken: ${(err as Error).message}`);
      this.logoUrl = '';
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const templatePath = path.join(process.cwd(), 'views', options.template, 'html.hbs');
    const source = fs.readFileSync(templatePath, 'utf-8');

    handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    const compiled = handlebars.compile(source);
    const rawHtml = compiled({ ...options.locals, logoUrl: this.logoUrl });

    const to = Array.isArray(options.message.to)
      ? (options.message.to.filter(Boolean) as string[])
      : [options.message.to as string];

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: options.message.subject,
      html: rawHtml,
      ...(options.message.attachments?.length
        ? { attachments: options.message.attachments }
        : {}),
    } as any);

    if (error) {
      this.logger.error(`Resend error: ${JSON.stringify(error)}`);
      throw new Error(error.message);
    }

    this.logger.log(`Email sent: id=${data?.id} to=${to.join(',')}`);
  }
}
