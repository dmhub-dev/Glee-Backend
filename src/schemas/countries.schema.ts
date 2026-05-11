import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Model } from 'mongoose';

export type CountriesDocument = Countries & Document;

@Schema({ timestamps: true, collection: 'countries' })
export class Countries extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  isoCode: string;

  @Prop({ required: false })
  latitude: string;

  @Prop({ required: false })
  longitude: string;
}

export const CountriesSchema = SchemaFactory.createForClass(Countries);
CountriesSchema.index({ name: 'text' });
