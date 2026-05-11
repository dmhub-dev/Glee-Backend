import { Stripe } from 'stripe';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  // SUSPENDED = 'SUSPENDED',
  // BLOCKED = 'BLOCKED',
}

export enum AccountStatusUser {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum EventStatus {
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum ServiceStatus {
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  SUSPENDED = 'SUSPENDED',
}

export enum BookingStatus {
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  SUSPENDED = 'SUSPENDED',
}

export enum PaymentStatus {
  SUCCEEDED = 'succeeded',
  PENDING = 'pending',
  FAILED = 'failed',
}
