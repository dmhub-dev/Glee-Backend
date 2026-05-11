import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';

export type StatesDocument = States & Document;

@Schema({ timestamps: true, collection: 'states' })
export class States extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  isoCode: string;

  @Prop({ required: true })
  countryCode: string;

  @Prop({ required: false })
  latitude: string;

  @Prop({ required: false })
  longitude: string;
}

export const StatesSchema = SchemaFactory.createForClass(States);
StatesSchema.index({ name: 'text' });
