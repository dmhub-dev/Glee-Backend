import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';

export type CitiesDocument = Cities & Document;

@Schema({ timestamps: true, collection: 'cities' })
export class Cities extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  stateCode: string;

  @Prop({ required: true })
  countryCode: string;

  @Prop({ required: false })
  latitude: string;

  @Prop({ required: false })
  longitude: string;
}

export const CitiesSchema = SchemaFactory.createForClass(Cities);
CitiesSchema.index({ name: 'text' });
