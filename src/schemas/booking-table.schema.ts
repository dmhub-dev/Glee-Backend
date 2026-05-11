import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { Booking } from 'src/schemas/booking.schema';
export type BookingTableDocument = BookingTable & Document;

@Schema({ timestamps: true, collection: 'Booking-Table' })
export class BookingTable extends Document {
  @Prop({
    required: false,
    type: Number,
  })
  tableNumber: number;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  })
  bookingId: Booking;

  @Prop({ type: Date })
  startTime: Date;

  @Prop({ type: Date })
  endTime: Date;

  @Prop({ type: Boolean, default: false })
  isBooked: boolean;

  @Prop({ type: Number })
  tablePrice: number;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const BookingTableSchema = SchemaFactory.createForClass(BookingTable);
