import Stripe from 'stripe';
import { StripeOptions } from './../interfaces';

const packageJson = {
  name: 'vtl-news',
  repository: '',
  version: '0.0.1',
};

export function getStripeClient({
  apiKey,
  appInfo = {
    name: packageJson.name,
    url: packageJson.repository,
    version: packageJson.version,
  },
  ...options
}: StripeOptions): Stripe {
  const stripeClient = new Stripe(apiKey, {
    appInfo,
    ...options,
  });

  return stripeClient;
}
