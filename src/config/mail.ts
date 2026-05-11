import * as nodemailer from 'nodemailer';

export default (mailData, config, callback) => {
  const transporter = nodemailer.createTransport({
    port: config.MAIL_PORT,
    host: config.MAIL_HOST,
    auth: {
      user: config.MAIL_USERNAME,
      pass: config.MAIL_PASSWORD,
    },
  });

  transporter.sendMail(mailData, function (err, info) {
    const result = err
      ? {
          success: false,
          message: 'Unable to send mail at this time',
          info: err.message,
        }
      : { success: true, message: 'Email sent successfully', info: info };
    callback(result);
  });
};
