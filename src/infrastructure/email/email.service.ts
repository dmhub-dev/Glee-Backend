import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from '@src/infrastructure/storage/s3.service';

export interface EmailAttachment {
  filename: string;
  content?: Buffer;
  contentType?: string;
  content_type?: string;
  path?: string;
  contentId?: string;
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
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${options.template}`);
    }
    const source = fs.readFileSync(templatePath, 'utf-8');

    handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    const compiled = handlebars.compile(source);
    const rawHtml = compiled({ ...options.locals, logoUrl: this.logoUrl });

    const to = Array.isArray(options.message.to)
      ? (options.message.to.filter(Boolean) as string[])
      : [options.message.to as string];
    if (!to.length) {
      throw new Error(`Email "${options.message.subject}" has no recipients`);
    }

    const attachments = options.message.attachments?.map(attachment => ({
      filename: attachment.filename,
      content: attachment.content,
      path: attachment.path,
      contentType: attachment.contentType ?? attachment.content_type,
      contentId: attachment.contentId ?? attachment.cid,
    }));

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: options.message.subject,
      html: rawHtml,
      ...(attachments?.length
        ? { attachments }
        : {}),
    } as any);

    if (error) {
      this.logger.error(`Resend error: ${JSON.stringify(error)}`);
      throw new Error(error.message);
    }

    this.logger.log(`Email sent: id=${data?.id} to=${to.join(',')}`);
  }
}
