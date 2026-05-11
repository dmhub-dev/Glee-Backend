import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NotificationType } from './enums/notification-enum';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '@src/schemas/user.shema';
import { Events } from '@src/schemas/events.schema';
import { EventTickets } from '@src/schemas/event.tickets.schema';
import { PurchasedService } from '@src/schemas/purchased-service.schema';
import { PurchasedBooking } from '@src/schemas/purchased-booking.schema';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ enum: NotificationType, default: NotificationType.CHAT })
  notificationType: NotificationType;

  //  admin notification  fields
  @Prop({ type: MongooseSchema.Types.ObjectId, refPath: 'orderModel' })
  orderPayload: string;

  @Prop({
    enum: [EventTickets.name, PurchasedService.name, PurchasedBooking.name],
    type: MongooseSchema.Types.String,
  })
  orderModel: string;

  @Prop({ type: MongooseSchema.Types.String })
  body: string;

  // user notification fields
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  from: MongooseSchema.Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
  })
  to: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
  })
  message: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Events.name,
  })
  eventId: MongooseSchema.Types.ObjectId;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
