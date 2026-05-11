import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { EventStatus } from './enums/status';
import { Category } from './categories.schema';
import { ILocation, IEventSchedule } from './interfaces/event.ticekt.d';
import { GeoLocationSchema } from './location.schema';
import { IUser } from './interfaces/user';
import { IEventSelectableFields } from './interfaces/event';
import { EventScheduleSchema } from './event-schedule.schema';

export const eventMinorDetails: IEventSelectableFields = {
  _id: 1,
  name: 1,
  location: 1,
  photos: 1,
  bannerImages: 1,
  price: 1,
  date: 1,
} as IEventSelectableFields;

export const adminGetRequestEventManagement: IEventSelectableFields = {
  _id: 1,
  name: 1,
  location: 1,
  category: 1,
  vendor: 1,
  date: 1,
  isActive: 1,
  price: 1,
} as IEventSelectableFields;

export type EventsDocument = Events & Document;

@Schema({ timestamps: true })
export class Events extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  })
  vendor: string;

  @Prop({ default: null })
  state: string;

  @Prop({ default: null })
  description: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  })
  category: Category;

  @Prop({ default: null })
  country: string;

  @Prop({
    index: '2dsphere',
    required: true,
    type: GeoLocationSchema,
  })
  loc: ILocation;

  @Prop({
    required: true,
    type: [EventScheduleSchema],
  })
  eventSchedule: [IEventSchedule];

  @Prop({ default: null })
  location: string;

  @Prop({ default: null })
  city: string;

  @Prop({
    default: null,
    type: {
      start: Date,
      end: Date,
    },
  })
  date: {
    start: Date;
    end: Date;
  };

  @Prop({ default: null })
  capacity: number;

  @Prop({ default: null })
  maxTicketPurchased: number;

  @Prop({ default: false })
  suspended: boolean;

  @Prop([String])
  bannerImages: string[];

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ default: null })
  price: number;

  @Prop({ type: Number })
  availableTickets: number;

  @Prop({ enum: EventStatus, default: EventStatus.ACTIVE })
  isActive: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;

  toMinorDetail: Function;
}

export const EventSchema = SchemaFactory.createForClass(Events);
EventSchema.index({ name: 'text' });
EventSchema.methods.toMinorDetail = function () {
  let data = <EventsDocument>this;
  let user: Partial<IUser> = {};
  Object.keys(eventMinorDetails).map((k) => (user[k] = data[k]));
  return user;
};
