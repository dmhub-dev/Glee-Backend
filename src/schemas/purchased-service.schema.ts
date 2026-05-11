import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import { Service } from './services.schema';
import { User } from 'src/schemas/user.shema';
export type PurchasedServiceDocument = PurchasedService & Document;

@Schema({ timestamps: true })
export class PurchasedService extends Document {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Service' })
  serviceId: Service;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: User.name })
  userId: User;

  // @Prop({ required: true })
  // totalPersons: number;

  // @Prop({ required: true })
  // totalPrice: number;

  // @Prop({ required: true })
  // perPersonPrice: number;

  @Prop({ type: Number, default: 0 })
  commission: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: false })
  cancelled: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const PurchasedServiceSchema =
  SchemaFactory.createForClass(PurchasedService);
