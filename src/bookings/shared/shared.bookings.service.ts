import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, QueryOptions, UpdateQuery } from 'mongoose';
import { Booking, BookingDocument } from 'src/schemas/booking.schema';
import {
  PurchasedBooking,
  PurchasedBookingDocument,
} from 'src/schemas/purchased-booking.schema';
import { bookingEarning } from '@src/bookings/aggregation/booking.aggregate';

@Injectable()
export class BookingSharedService {
  constructor(
    @InjectModel(Booking.name)
    private bookingModel: Model<BookingDocument>,
    @InjectModel(PurchasedBooking.name)
    private purchasesBookingModel: Model<PurchasedBookingDocument>,
  ) {}

  // Helper Functions
  // ===================================================================================================================

  async helperBookingFindById(_id: string) {
    return this.bookingModel
      .findById({ _id, isDeleted: false })
      .populate('vendor', 'email');
  }

  async calculateBookingsEarning(id) {
    return this.purchasesBookingModel.aggregate(bookingEarning(id));
  }
}
