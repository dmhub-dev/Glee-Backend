import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GeoLocationDocument = GeoLocation & Document;

@Schema({ timestamps: true })
export class GeoLocation extends Document {
  @Prop({ type: String, enum: ['Point'] })
  type: string;

  @Prop({ type: [Number] })
  coordinates: [number];
}

export const GeoLocationSchema = SchemaFactory.createForClass(GeoLocation);
