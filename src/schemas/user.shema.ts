import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Schema as MongooseSchema, Model } from 'mongoose';
import { Role } from './enums/role';
import { AccountStatus } from './enums/status';
import { CountryCodes } from '../shared/countries';
import { IUser, IUserSelectableFields } from './interfaces/user';
import jwt from 'jsonwebtoken';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Countries } from '@src/schemas/countries.schema';
import { Cities } from '@src/schemas/cities.schema';
import { States } from '@src/schemas/states.schema';
import { VendorDocument } from './vendor.schema';

export type UserDocument = User & Document;

export const adminGetRequestEventManagementUser: IUserSelectableFields = {
  name: 1,
  _id: 1,
  phone: 1,
  state: 1,
  address: 1,
  city: 1,
  country: 1,
  email: 1,
  profileImage: 1,
} as object;

export const userPublicFields: IUserSelectableFields = {
  name: 1,
  phone: 1,
  state: 1,
  address: 1,
  city: 1,
  country: 1,
  email: 1,
  profileImage: 1,
  role: 1,
  _id: 1,
  adminContactInfo: 1,
  blockedUsersList: 1,
  notificationStatus: 1,
  profileStatus: 1,
  haveNewNotification: 1,
  isAllChatRead: 1,
  notificationIds: 1,
  vendor_id:1
} as object;

export const userLoginResFields: IUserSelectableFields = {
  ...userPublicFields,
  token: 1,
};

export const userPrivateFields: IUserSelectableFields = {
  otp: 1,
  token: 1,
  password: 1,
};

export const userInternalUsedFields: IUserSelectableFields = {
  isActive: 1,
  role: 1,
  notificationIds: 1,
  blockedUsersList: 1,
  notificationStatus: 1,
  deletedAt: 1,
  otp: 1,
  isDeleted: 1,
  token: 1,
  password: 1,
};

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, type: String })
  name: string;

  @Prop({ default: null, type: String })
  phone: string;

  @Prop({ require: true, unique: true, type: String })
  email: string;


  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  })
  vendor_id: VendorDocument;
  
  @Prop({
    default: null,
    ref: States.name,
    type: MongooseSchema.Types.ObjectId,
  })
  state: string;

  @Prop({
    default: null,
    ref: Countries.name,
    type: MongooseSchema.Types.ObjectId,
  })
  country: string;

  @Prop({ default: null, type: String })
  address: string;

  @Prop({
    default: null,
    ref: Cities.name,
    type: MongooseSchema.Types.ObjectId,
  })
  city: string;

  @Prop({ required: true, type: String })
  password: string;

  @Prop({ required: false, default: null, type: String })
  profileImage: string;

  @Prop({ default: null, type: String })
  token: string;

  @Prop({ required: true, enum: Role, default: Role.USER, type: String })
  role: string;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE, type: String })
  isActive: string;

  @Prop({ default: null, type: Number })
  otp: number;

  @Prop({ type: Number })
  margin: number;

  @Prop({
    type: [
      {
        _id: String,
        link: String,
        name: String,
        icon: String,
      },
    ],
  })
  adminContactInfo: number;

  @Prop({ default: false, type: Boolean })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop({
    default: null,
    type: [
      {
        type: MongooseSchema.Types.ObjectId,
        ref: 'User',
      },
    ],
  })
  blockedUsersList: string[];

  @Prop({ default: true, type: Boolean })
  profileStatus: boolean;

  @Prop({ default: [], type: [String] })
  notificationIds: string[];

  @Prop({ default: true, type: Boolean })
  notificationStatus: boolean;

  @Prop({ default: true, type: Boolean })
  isAllChatRead: boolean;

  @Prop({ default: true, type: Boolean })
  haveNewNotification: boolean;

  softDelete: Function;
  toPublicData: Function;
  toAuthData: Function;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({
  name: 'text',
  email: 'text',
  phone: 'text',
  country: 'text',
  city: 'text',
  address: 'text',
  state: 'text',
});
UserSchema.pre('findOne', function (next) {
  let self: any = this;
  let fields: any = self._fields;
  if (fields?.withDeleted) {
    return next();
  }
  this.where({ isDeleted: false });
  return next();
});

UserSchema.pre('find', function (next) {
  let self: any = this;
  let fields: any = self._fields;
  if (fields?.withDeleted) {
    return next();
  }
  this.where({ isDeleted: false });
  return next();
});

/**
 * Note: These methods are attached with user documents
 */
UserSchema.methods.softDelete = async function () {
  try {
    this.isDeleted = true;
    this.deletedAt = new Date();
    const doc = await this.save();
    return {
      success: true,
      data: doc,
    };
  } catch (error) {
    throw new HttpException(
      'Something went wrong',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
};

UserSchema.methods.toPublicData = function () {
  let data = <UserDocument>this;
  let user: Partial<IUser> = {};
  Object.keys(userPublicFields).map((k) => (user[k] = data[k]));
  return user;
};

UserSchema.methods.toAuthData = function () {
  let data = <UserDocument>this;
  let user: Partial<IUser> = {};
  Object.keys(userLoginResFields).map((k) => (user[k] = data[k]));
  return user;
};

/**
 * Note: These methods are attached with user model
 */
UserSchema.statics.getUserPublicData = async function (
  _id: MongooseSchema.Types.ObjectId,
): Promise<UserDocument> {
  return this.findById(_id, { ...userPublicFields });
};

UserSchema.statics.getUserPrivateData = async function (
  _id: MongooseSchema.Types.ObjectId,
): Promise<UserDocument> {
  return this.findById(_id, { ...userPrivateFields });
};

UserSchema.statics.getUserInternalUseData = async function (
  _id: MongooseSchema.Types.ObjectId,
): Promise<UserDocument> {
  return this.findById(_id, { ...userInternalUsedFields });
};
