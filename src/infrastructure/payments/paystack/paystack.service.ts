import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  PAYSTACK_BASE_URL,
  PAYSTACK_ENDPOINTS,
  PAYSTACK_HEADERS,
} from './paystack.constant';
import {
  PaystackEvent,
  PaystackInitializeResponse,
  PaystackVerifyTransactionResponse,
  PaystackWebhookData,
  PaystackWebhookPayload,
  PurchasingType,
} from './paystack.types';
import { PaystackPaymentIntentDto } from './dto/paystack.dto';

export interface IPaystackWebhookHandler {
  createPurchasedEventTicket?(metadata: any, reference: string): Promise<any>;
  createEventTicketViaPaystack?(data: any): Promise<any>;
}
export interface IBookingWebhookHandler {
  createPurchasedBooking?(metadata: any, reference: string): Promise<any>;
  createDepositPurchasedBookingViaPaystack?(data: any): Promise<any>;
}
export interface IServiceWebhookHandler {
  createPurchasedService?(metadata: any, reference: string): Promise<any>;
}
export interface IWalletWebhookHandler {
  createTopUpWalletPayment?(data: any, reference: string): Promise<any>;
}

@Injectable()
export class PayStackService {
  private readonly logger = new Logger(PayStackService.name);

  eventTicketsHandler: IPaystackWebhookHandler | null = null;
  purchaseBookingHandler: IBookingWebhookHandler | null = null;
  purchasedServiceHandler: IServiceWebhookHandler | null = null;
  walletHandler: IWalletWebhookHandler | null = null;

  constructor(private readonly configService: ConfigService) {}

  async createPaymentIntent(body: PaystackPaymentIntentDto) {
    try {
      const response = await axios.post<PaystackInitializeResponse>(
        `${PAYSTACK_BASE_URL}${PAYSTACK_ENDPOINTS.INITIALIZE_TRANSACTION}`,
        {
          email: body.email,
          amount: body.amount * 100,
          metadata: body.metaData,
          channels: ['card', 'mobile_money'],
        },
        { headers: PAYSTACK_HEADERS(this.configService.get('PAYSTACK_SECRET_KEY')) },
      );

      const data = response?.data?.data;
      if (!data?.reference) throw new BadRequestException('Invalid Paystack initialize response');

      return {
        ...data,
        verificationToken: this.generateTransactionVerificationToken(data.reference),
      };
    } catch (err: any) {
      throw new BadRequestException(err.response?.data || err.message);
    }
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.configService.get('PAYSTACK_SECRET_KEY'))
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }

  generateTransactionVerificationToken(transactionRef: string): string {
    const payload = { transactionRef, timestamp: Date.now() };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto
      .createHmac('sha256', this._verificationSecret())
      .update(payloadBase64)
      .digest('hex');
    return `${payloadBase64}.${signature}`;
  }

  async verifyTransaction(token: string) {
    const payload = this._decodeToken(token);
    try {
      const response = await axios.get<PaystackVerifyTransactionResponse>(
        `${PAYSTACK_BASE_URL}${PAYSTACK_ENDPOINTS.VERIFY_TRANSACTION}/${encodeURIComponent(payload.transactionRef)}`,
        { headers: PAYSTACK_HEADERS(this.configService.get('PAYSTACK_SECRET_KEY')) },
      );
      if (!response.data?.status) throw new BadRequestException(response.data?.message || 'Verification failed');
      return { verificationStatus: 'success', paystack: response.data };
    } catch (err: any) {
      throw new BadRequestException(err.response?.data || err.message);
    }
  }

  async processWebhookEvent(payload: PaystackWebhookPayload) {
    const { event, data } = payload;
    switch (event) {
      case PaystackEvent.CHARGE_SUCCESS:
        await this.handleChargeSuccess(data);
        break;
      default:
        this.logger.warn(`Unhandled Paystack event: ${event}`);
    }
  }

  private async handleChargeSuccess(data: PaystackWebhookData) {
    const metadata = data.metadata as any;
    if (!('purchasingType' in metadata)) return;

    switch (metadata.purchasingType) {
      case PurchasingType.PURCHASED_SERVICE:
        await this.purchasedServiceHandler?.createPurchasedService?.(metadata, data.reference);
        break;
      case PurchasingType.BOOKING:
        await this.purchaseBookingHandler?.createPurchasedBooking?.(metadata, data.reference);
        break;
      case PurchasingType.EVENT_TICKET:
        await this.eventTicketsHandler?.createPurchasedEventTicket?.(metadata, data.reference);
        break;
      case PurchasingType.TOP_UP_WALLET:
        await this.walletHandler?.createTopUpWalletPayment?.(data, data.reference);
        break;
      case PurchasingType.PURCHASE_BOOKING_WITH_CASH_DEPOSIT:
        await this.purchaseBookingHandler?.createDepositPurchasedBookingViaPaystack?.(data);
        break;
      case PurchasingType.PURCHASE_EVENT_WITH_CASH_DEPOSIT:
        await this.eventTicketsHandler?.createEventTicketViaPaystack?.(data);
        break;
    }
  }

  private _verificationSecret(): string {
    return (
      this.configService.get('PAYSTACK_VERIFICATION_TOKEN_SECRET') ||
      this.configService.get('PAYSTACK_SECRET_KEY') ||
      ''
    );
  }

  private _decodeToken(token: string, maxAgeMs = 3600 * 1000) {
    if (!token?.includes('.')) throw new BadRequestException('Invalid verification token');

    const [payloadBase64, signature] = token.split('.');
    const expected = crypto
      .createHmac('sha256', this._verificationSecret())
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expected) throw new BadRequestException('Invalid token signature');

    let payload: { transactionRef: string; timestamp: number };
    try {
      payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed token payload');
    }

    if (!payload.transactionRef || !payload.timestamp) throw new BadRequestException('Invalid token payload');
    if (Date.now() - payload.timestamp > maxAgeMs) throw new BadRequestException('Verification token expired');

    return payload;
  }
}
