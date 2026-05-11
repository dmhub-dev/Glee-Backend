import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { BookingStatus } from './enums/status';
import { Category } from './categories.schema';
import { GeoLocationSchema } from './location.schema';
import { ILocation } from './interfaces/event.ticekt';
export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  })
  vendor: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ required: true, type: Date })
  startTime: Date;

  @Prop({ required: true, type: Date })
  endTime: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category: Category;

  @Prop({
    index: '2dsphere',
    required: true,
    type: GeoLocationSchema,
  })
  loc: ILocation;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 0 })
  price: number;

  @Prop([String])
  photos: string[];

  @Prop({ type: [String] })
  bookingDetails: string[];

  @Prop({ enum: BookingStatus, default: BookingStatus.ACTIVE })
  status: string;

  @Prop({ default: null })
  capacity: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ name: 'text' });
