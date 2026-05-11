import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { ServiceStatus } from './enums/status';
import { Category } from './categories.schema';
import { GeoLocationSchema } from './location.schema';
import { ILocation } from './interfaces/event.ticekt';
import { IServiceSelectableFields } from './interfaces/services';
import { VendorDocument } from '@src/schemas/vendor.schema';

export type ServiceDocument = Service & Document;

export const serviceMinorDetails: IServiceSelectableFields = {
  _id: 1,
  name: 1,
  address: 1,
  photos: 1,
  bannerImages: 1,
  price: 1,
  date: 1,
} as IServiceSelectableFields;

@Schema({ timestamps: true })
export class Service extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  })
  vendor: string | VendorDocument;

  @Prop({ default: '' })
  address: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category: Category;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({
    index: '2dsphere',
    required: true,
    type: GeoLocationSchema,
  })
  loc: ILocation;

  @Prop([String])
  photos: string[];

  @Prop({ type: [String] })
  serviceDetails: string[];

  @Prop({ enum: ServiceStatus, default: ServiceStatus.ACTIVE })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
ServiceSchema.index({ name: 'text' });
