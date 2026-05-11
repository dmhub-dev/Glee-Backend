import * as mongoose from 'mongoose';
import { UserDocument } from '../user.shema';

export interface IVendor {
  _id?: string | mongoose.Types.ObjectId;

  name: string;

  phone: string;

  email: string;

  state: string;

  country: string;

  address: string;

  city: string;

  password: string;

  profileImage?: string;

  token?: string;

  isActive?: string;

  isDeleted?: boolean;

  deletedAt?: Date;
}

export interface IVendorSelectableFields {
  name?: number;

  phone?: number;

  email?: number;

  state?: number;

  country?: number;

  address?: number;

  city?: number;

  password?: number;

  profileImage?: number;

  // token?: number;

  isActive?: number;

  isDeleted?: number;

  deletedAt?: number;
}
