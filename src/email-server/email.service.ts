import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Email from 'email-templates';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as path from 'path';

import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class EmailService {
  transporter: Transporter<SMTPTransport.SentMessageInfo> = null;

  constructor(private configService: ConfigService) {
    const config = this.configService.get('EMAIL_SMTP');
    this.transporter = nodemailer.createTransport({
      port: config.MAIL_PORT,
      host: config.MAIL_HOST,
      auth: {
        user: config.MAIL_USERNAME,
        pass: config.MAIL_PASSWORD,
      },
    });
  }

  sendMail(options: Email.EmailOptions) {
    const email = new Email({
      views: { root: './views', options: { extension: 'hbs' } },
      message: {
        from: this.configService.get('EMAIL_SMTP').MAIL_FROM_ADDRESS,
      },
      preview: false,
      send: true,
      transport: this.transporter,
      // <https://github.com/Automattic/juice>
      juice: true,
      // Override juice global settings <https://github.com/Automattic/juice#juicecodeblocks>
      juiceSettings: {
        tableElements: ['TABLE'],
      },
      juiceResources: {
        preserveImportant: true,
        webResources: {
          //
          // this is the relative directory to your CSS/image assets
          // and its default path is `build/`:
          //
          // e.g. if you have the following in the `<head`> of your template:
          // `<link rel="stylesheet" href="style.css" data-inline="data-inline">`
          // then this assumes that the file `build/style.css` exists
          //
          relativeTo: path.resolve('views'),
          //
          // but you might want to change it to something like:
          // relativeTo: path.join(__dirname, '..', 'assets')
          // (so that you can re-use CSS/images that are used in your web-app)
          //
        },
      },
    });

    return email.send(options);
  }
}
