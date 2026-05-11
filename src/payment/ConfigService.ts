import { Injectable } from '@nestjs/common';
import { StripeOptions } from '../stripe';
import { ConfigService as AppConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly config: AppConfigService) {}

  public getStripeConfig(): StripeOptions {
    return {
      apiKey: this.config.get('STRIPE.SECRET_KEY'),
      apiVersion: '2022-08-01',
    };
  }
}
