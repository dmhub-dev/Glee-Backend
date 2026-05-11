import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { AccountStatus } from './enums/status';
import { IVendorSelectableFields } from './interfaces/vendor';
import { User } from './user.shema';

export const adminGetRequestEventManagementVendor: IVendorSelectableFields = {
  _id: 1,
  name: 1,
  userId: 1,
} as IVendorSelectableFields;

export type VendorDocument = Vendor & Document;

@Schema({ timestamps: true })
export class Vendor extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ default: null })
  phone: string;

  @Prop({ require: true, unique: true })
  email: string;

  @Prop({ default: null })
  state: string;

  @Prop({ default: null })
  country: string;

  @Prop({ default: null })
  address: string;

  @Prop({ default: null })
  city: string;

  @Prop({ default: null })
  routingNumber: string;

  @Prop({ default: null })
  businessAccount: string;

  //   @Prop({ required: true })
  //   password: string;

  @Prop({ required: false, default: null })
  profileImage: string;

  //   @Prop({ default: null })
  //   token: string;

  //   @Prop({ required: true, enum: Role, default: Role.USER })
  //   role: string;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  isActive: string;

  //   @Prop({ default: null })
  //   otp: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
VendorSchema.index({name: 'text'});
