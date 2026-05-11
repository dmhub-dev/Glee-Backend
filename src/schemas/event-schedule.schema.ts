import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventScheduleDocument = EventSchedule & Document;

@Schema({ timestamps: true })
export class EventSchedule extends Document {
  @Prop({ type: String })
  note: string;

  @Prop({ type: Date })
  time: Date;
}

export const EventScheduleSchema = SchemaFactory.createForClass(EventSchedule);
