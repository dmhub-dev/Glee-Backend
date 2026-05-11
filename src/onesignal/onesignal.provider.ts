import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

export const OnesignalHttpModule = HttpModule.registerAsync({
  useFactory: (config: ConfigService) => ({
    baseUrl: config.get('ONESIGNAL').ONE_SIGNAL_API_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${config.get('ONESIGNAL').ONE_SIGNAL_API_KEY}`,
    },
  }),
  inject: [ConfigService],
});
