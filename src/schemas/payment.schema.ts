import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PaymentStatus } from './enums/status';
import { IPaymentSelectableFields } from './interfaces/payment';
import { IEventTicketSelectableFields } from './interfaces/event.ticekt';

export const adminGetRequestEventManagementPayment: IPaymentSelectableFields = {
  transactionId: 1,
  totalPrice: 1,
  noOfItems: 1,
} as IPaymentSelectableFields;
export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop()
  transactionId: string;

  @Prop()
  bankAccountNumber: string;

  @Prop({ default: false, enum: PaymentStatus })
  paymentStatus: string;

  @Prop({ required: false, type: Number })
  noOfItems: number;

  @Prop({ required: false, type: Number })
  totalPrice: number;

  @Prop({ required: false, type: Number })
  perItemPrice: number;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
