import { PaymentDocument } from '../payment.schema';
import { UserDocument } from '../user.shema';
import { EventsDocument } from '../events.schema';
import { ObjectId } from 'bson';

export interface IEventTicket {
  eventId?: string | EventsDocument | ObjectId;
  userId?: string | UserDocument | ObjectId;
  cancelled?: boolean;
  paymentId?: string | PaymentDocument;
  isDeleted?: boolean;
  deletedAt?: Date;
  _id?: string;
}

export interface ILocation {
  type: string;
  coordinates: Array<number>;
}

export interface IEventSchedule {
  note: string;
  time: Date;
}

export interface IEventTicketSelectableFields {
  eventId?: number;
  userId?: number;
  cancelled?: number;
  paymentId?: number;
  isDeleted?: number;
  deletedAt?: number;
  _id?: number;
}
