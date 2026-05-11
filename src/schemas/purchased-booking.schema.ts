import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Booking } from './booking.schema';
import { User } from 'src/schemas/user.shema';
import { BookingType } from './enums/bookingType-enum';
import { BookingTable } from 'src/schemas/booking-table.schema';

export type PurchasedBookingDocument = PurchasedBooking & Document;

@Schema({ timestamps: true })
export class PurchasedBooking extends Document {
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: Booking.name,
  })
  bookingId: Booking;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: User.name })
  userId: User;

  @Prop({
    enum: BookingType,
    default: BookingType.VENUE,
    type: String,
    required: true,
  })
  bookingType: BookingType;

  @Prop({ type: Number, default: 0 })
  commission: number;

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: BookingTable.name,
  })
  tableId: BookingTable;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: false })
  cancelled: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  paymentId: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

export const PurchasedBookingSchema =
  SchemaFactory.createForClass(PurchasedBooking);
