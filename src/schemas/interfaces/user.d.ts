import * as mongoose from 'mongoose';
import { UserDocument } from '../user.shema';

export interface IUser {
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

  role: string;

  isActive?: string;

  otp?: number;

  isDeleted?: boolean;

  deletedAt?: Date;

  blockedUsersList?: [
    {
      userId: string;
    },
  ];

  notificationIds?: string[];

  notificationStatus?: boolean;
}

export interface IUserSelectableFields {
  name?: number;

  phone?: number;

  email?: number;

  state?: number;

  country?: number;

  address?: number;

  city?: number;

  password?: number;

  profileImage?: number;

  token?: number;

  role?: number;

  isActive?: number;

  otp?: number;

  isDeleted?: number;

  deletedAt?: number;

  blockedUsersList?: number;

  notificationIds?: number;

  notificationStatus?: number;

  adminContactInfo?: number;
}

export interface IUserModel extends mongoose.Model<UserDocument> {
  getUserPublicData: (_id: mongoose.Types.ObjectId) => Promise<UserDocument>;
  getUserPrivateData: (_id: mongoose.Types.ObjectId) => Promise<UserDocument>;
  getUserInternalUseData: (
    _id: mongoose.Types.ObjectId,
  ) => Promise<UserDocument>;
}
