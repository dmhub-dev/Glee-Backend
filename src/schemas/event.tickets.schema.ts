import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, model, Schema as MongooseSchema } from 'mongoose';
import { Events, EventSchema, EventsDocument } from './events.schema';
import { User } from 'src/schemas/user.shema';
import { IEventTicketSelectableFields } from './interfaces/event.ticekt';

export type EventTicketsDocument = EventTickets & Document;

const adminGetRequestEventManagementTicket: IEventTicketSelectableFields = {
  paymentId: 1,
  eventId: 1,
  userId: 1,
  isDeleted: 1,
  deletedAt: 1,
  cancelled: 1,
} as IEventTicketSelectableFields;

@Schema({ timestamps: true, collection: 'event-tickets' })
export class EventTickets extends Document {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Events' })
  eventId: Events;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  userId: User;

  @Prop({ type: Number, default: 0 })
  commission: number;

  @Prop({ default: false })
  cancelled: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  @Prop({ type: EventSchema })
  deletedEventData: EventsDocument;
}

export const EventTicketsSchema = SchemaFactory.createForClass(EventTickets);
