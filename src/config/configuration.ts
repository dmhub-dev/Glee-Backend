export default () => ({
  APP_NAME: process.env.APP_NAME,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,

  EXPIRESIN: process.env.EXPIRESIN,
  SECRETKEY: process.env.SECRETKEY,

  DB_CON_STRING: process.env.DB_CON_STRING,

  EMAIL_SMTP: {
    MAIL_SECURE: process.env.MAIL_SECURE,
    MAIL_PORT: process.env.MAIL_PORT,
    MAIL_HOST: process.env.MAIL_HOST,
    MAIL_USERNAME: process.env.MAIL_USERNAME,
    MAIL_PASSWORD: process.env.MAIL_PASSWORD,
    MAIL_ENCRYPTION: process.env.MAIL_ENCRYPTION,
    MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
    PHONE_NUMBER: process.env.PHONE_NUMBER,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
    APP_NAME: process.env.APP_NAME,
  },

  NEWS: {
    NEWS_DATA_API_KEY: process.env.NEWS_DATA_API_KEY,
    NEWS_DATA_API_URL: process.env.NEWS_DATA_API_URL,
    NEWS_DATA_BASE_URL: process.env.NEWS_DATA_BASE_URL,
    STATE_NEWS_API_URL: process.env.STATE_NEWS_API_URL,
    STATE_NEWS_API_KEY: process.env.STATE_NEWS_API_KEY,
    STATE_NEWS_API_HOST: process.env.STATE_NEWS_API_HOST,
  },
  ONESIGNAL: {
    ONE_SIGNAL_APP_ID: process.env.ONE_SIGNAL_APP_ID,
    ONE_SIGNAL_API_KEY: process.env.ONE_SIGNAL_API_KEY,
    ONE_SIGNAL_API_URL: process.env.ONE_SIGNAL_API_URL,
  },

  STRIPE: {
    SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  },
});
