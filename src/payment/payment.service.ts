import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectStripe } from '../stripe';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { InjectModel } from '@nestjs/mongoose';
import { AnyKeys, Model } from 'mongoose';

export enum PaymentMethods {
  ONE_TIME = 0,
  SAVE_CARDS = 1,
  BANK_ACCOUNT = 2,
}

export interface ChargeOptions {
  customerId?: string;
  cardDetails?: Stripe.TokenCreateParams.Card;
  bankDetails?: Stripe.TokenCreateParams.BankAccount;
}

@Injectable()
export class PaymentService {
  public constructor(
    @InjectStripe()
    private readonly stripeClient: Stripe,
    @InjectModel(Payment.name)
    private PaymentModel: Model<PaymentDocument>,
  ) {}

  // Helper Function
  // ===================================================================================================================

  async helperCreatePayment(
    data: AnyKeys<PaymentDocument>,
  ): Promise<PaymentDocument> {
    return this.PaymentModel.create(data);
  }

  // Route Specific Function
  // ===================================================================================================================

  /**
   * Note: Create charges to deduct payment from user
   */
  async createPaymentCharges(
    method: PaymentMethods,
    chargesParam: Stripe.ChargeCreateParams,
    options?: ChargeOptions,
  ): Promise<{ status: Stripe.Charge.Status; id: string }> {
    if (method === PaymentMethods.ONE_TIME) {
      if (!options.cardDetails)
        throw new HttpException(
          'Card Details required for creating the charges.',
          HttpStatus.BAD_REQUEST,
        );
      const token = await this.stripeClient.tokens.create({
        card: options.cardDetails,
      });
      // {
      //   amount: 1000,
      //       currency: 'usd',
      //     // source: cardToken.id,
      //     receipt_email: '',
      //     description: `Stripe Charge Of Amount ${1000} for One Time Payment`,
      // }
      const charge = await this.stripeClient.charges.create({
        ...chargesParam,
        source: token.id,
      });

      return {
        status: charge.status,
        id: charge.id,
      };
    } else if (method === PaymentMethods.SAVE_CARDS) {
      const cardList = await this.retrieveCustomerCards(options.customerId);
      if (cardList.data.length == 0)
        throw new HttpException(
          'Customer have not register any card yet.',
          HttpStatus.BAD_REQUEST,
        );
      const charge = await this.stripeClient.charges.create({
        ...chargesParam,
        source: cardList.data[cardList.data.length - 1].id,
      });
      return {
        status: charge.status,
        id: charge.id,
      };
    } else if (method === PaymentMethods.BANK_ACCOUNT) {
      if (!options.bankDetails)
        throw new HttpException(
          'Bank Account Details required for creating the charges.',
          HttpStatus.BAD_REQUEST,
        );

      let source = await this.createUserBankAccountSource(
        options.customerId,
        options.bankDetails,
      );

      const charge = await this.stripeClient.charges.create({
        ...chargesParam,
        source: source.id,
      });

      return {
        status: charge.status,
        id: charge.id,
      };
    }
  }

  async getTransactionDetails(
    id: string,
  ): Promise<Stripe.Response<Stripe.Charge>> {
    return await this.stripeClient.charges.retrieve(id);
  }

  /**
   * Note: Create Stripe Customer
   */
  async createStripeCustomer(
    params: Stripe.CustomerCreateParams,
    options?: Stripe.RequestOptions,
  ): Promise<Stripe.Response<Stripe.Customer>> {
    return await this.stripeClient.customers.create({
      ...params,
    });
  }

  /**
   * Note: Create user card for back accounts
   */
  async createUserBankAccountSource(
    customerId: string,
    bankDetails: Stripe.TokenCreateParams.BankAccount,
  ): Promise<Stripe.Response<Stripe.CustomerSource>> {
    // {
    //   country: 'US',
    //   currency: 'usd',
    //   account_holder_name: 'xxx',
    //   account_holder_type: 'individual',
    //   routing_number: 'ACH',
    //   account_number: 'xx',
    // }
    let token = await this.stripeClient.tokens.create({
      bank_account: {
        ...bankDetails,
      },
    });

    return await this.stripeClient.customers.createSource(customerId, {
      source: token.id,
    });
  }

  /**
   * Note: Create user card using card details like debit or credit card number
   * @param custId
   * @param cardDetails
   */
  async createUserCardSource(
    customerId: string,
    cardDetails: Stripe.TokenCreateParams.Card,
  ): Promise<Stripe.Response<Stripe.CustomerSource>> {
    let token = await this.stripeClient.tokens.create({
      card: {
        ...cardDetails,
      },
    });

    return await this.stripeClient.customers.createSource(customerId, {
      source: token.id,
    });
  }

  /**
   * Note: Retrieve all saved card of customer for payment
   * @param customerId
   */
  retrieveCustomerCards(
    customerId: string,
    params?: Stripe.CustomerSourceListParams,
  ): Stripe.ApiListPromise<Stripe.CustomerSource> {
    return this.stripeClient.customers.listSources(customerId, {
      limit: 5,
      ...params,
    });
  }
}
