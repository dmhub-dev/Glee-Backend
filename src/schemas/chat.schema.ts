import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';
import { User } from '@src/schemas/user.shema';
import { Events } from '@src/schemas/events.schema';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true, collection: 'chat' })
export class Chat extends Document {
  @Prop({ required: true, ref: User.name, type: MongooseSchema.Types.ObjectId })
  from: string;

  @Prop({ required: true, ref: User.name, type: MongooseSchema.Types.ObjectId })
  to: string;

  @Prop({ required: true, type: String })
  message: string;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: Events.name,
  })
  eventId: MongooseSchema.Types.ObjectId;

  @Prop({ required: false, type: Boolean })
  isRead: boolean;

  createdAt: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
ChatSchema.index({ name: 'text' });
