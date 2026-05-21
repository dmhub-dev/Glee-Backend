import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface SendMailOptions {
  template: string
  message: {
    to: string | string[]
    subject: string
    attachments?: unknown[]  // accepted but unused — Resend handles assets via URLs
  }
  locals: Record<string, unknown>
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logoCid: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('RESEND_FROM') ?? 'Glee <tickets@gleefolder.com>';

    // Pre-compute inline logo data URI so cid:logo in templates resolves
    const logoPath = path.join(process.cwd(), 'views', 'logo.svg');
    const logoB64 = fs.readFileSync(logoPath).toString('base64');
    this.logoCid = `data:image/svg+xml;base64,${logoB64}`;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const templatePath = path.join(process.cwd(), 'views', options.template, 'html.hbs');
    const source = fs.readFileSync(templatePath, 'utf-8');

    handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    const compiled = handlebars.compile(source);
    const rawHtml = compiled(options.locals);

    // Replace nodemailer CID references with inline data URIs
    const html = rawHtml.replace(/cid:logo/g, this.logoCid);

    const to = Array.isArray(options.message.to)
      ? (options.message.to.filter(Boolean) as string[])
      : [options.message.to as string];

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: options.message.subject,
      html,
    });

    if (error) {
      this.logger.error(`Resend error: ${JSON.stringify(error)}`);
      throw new Error(error.message);
    }

    this.logger.log(`Email sent: id=${data?.id} to=${to.join(',')}`);
  }
}
