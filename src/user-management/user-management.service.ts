import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { User, UserDocument, userPublicFields } from 'src/schemas/user.shema';
import {
  AddCommissionDto,
  UserDto,
  UserStatusAndNotificationAdminDto,
} from './dto/admin-users.dto';
import { Role } from '../schemas/enums/role';
import * as mongoose from 'mongoose';
import {
  UserProfileUpdateDto,
  UserStatusAndNotificationDto,
} from './dto/user.dto';
import { ConfigService } from '@nestjs/config';
import { getArray } from '@src/shared/utils';
import { loggers } from '@src/interceptors/logger.enums';
import { ObjectId } from 'bson';
import { Countries, CountriesDocument } from '@src/schemas/countries.schema';
import { Cities, CitiesDocument } from '@src/schemas/cities.schema';
import { States, StatesDocument } from '@src/schemas/states.schema';

@Injectable()
export class UserManagementService {
  constructor(
    @InjectModel(User.name)
    private UserModel: Model<UserDocument>,
    @InjectModel(Countries.name)
    private CountriesModel: Model<CountriesDocument>,
    @InjectModel(Cities.name)
    private CitiesModel: Model<CitiesDocument>,
    @InjectModel(States.name)
    private StatesModel: Model<StatesDocument>,
    public configService: ConfigService,
  ) {}

  async addCommission(addCommissionDto: AddCommissionDto, userId: String) {
    let user: UserDocument = await this.UserModel.findByIdAndUpdate(
      { _id: userId },
      { margin: addCommissionDto.commission },
      { new: true },
    );
    if (!user) {
      throw new HttpException(
        "Admin doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      success: true,
      msg: 'commission added successfuly',
      data: user.margin,
    };
  }

  async getCommission(userId: string) {
    let user: UserDocument = await this.UserModel.findById(userId);
    if (!user) {
      throw new HttpException(
        "Admin doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!user.margin) {
      return {
        success: true,
        msg: "This Admin doesn't set any commission rate yet",
        data: 0,
      };
    }
    return {
      success: true,
      msg: 'commission fetched successfuly',
      data: user.margin,
    };
  }

  async findAll(userQueryDto: UserDto) {
    let query: Partial<FilterQuery<UserDocument>> = {
      role: Role.USER,
      isDeleted: false,
    };
    if (userQueryDto.isDeleted) query.isDeleted = userQueryDto.isDeleted;
    if (userQueryDto.status) query.isActive = userQueryDto.status;
    if (userQueryDto.search)
      query.$text = {
        $search: userQueryDto.search,
      };

    const users: UserDocument[] = await this.UserModel.find(query, {
      ...userPublicFields,
      isActive: 1,
    })
      .populate('country', 'isoCode name _id')
      .populate('city', 'isoCode name _id countryCode stateCode')
      .populate('state', 'isoCode name _id countryCode')
      .skip((userQueryDto.page - 1) * userQueryDto.limit)
      .limit(userQueryDto.limit)
      .sort('-createdAt');

    const docCount = await this.UserModel.count(query);
    return {
      success: true,
      data: users,
      page: userQueryDto.page,
      limit: userQueryDto.limit,
      totalPages: Math.ceil(docCount / userQueryDto.limit),
    };
  }

  async findOne(id) {
    const users: UserDocument = await this.UserModel.findById(id, {
      ...userPublicFields,
    })
      .populate('country', 'isoCode name _id')
      .populate('city', 'isoCode name _id countryCode stateCode')
      .populate('state', 'isoCode name _id countryCode');
    return {
      success: true,
      data: users,
    };
  }

  async updateProfile(
    userProfileUpdateDto: UserProfileUpdateDto,
    userId,
    file?: Express.Multer.File,
  ) {
    if (file) {
      userProfileUpdateDto.profileImage = `${this.configService.get(
        'APP_URL',
      )}/upload/${file.filename}`;
    }

    // if (userProfileUpdateDto.country) {
    //   let country = await this.CountriesModel.findById(
    //     userProfileUpdateDto.country,
    //   ).lean();
    //   userProfileUpdateDto.country = country.name;
    // }
    // if (userProfileUpdateDto.city) {
    //   let city = await this.CitiesModel.findById(userProfileUpdateDto.city);
    //   userProfileUpdateDto.city = city.name;
    // }
    // if (userProfileUpdateDto.state) {
    //   let state = await this.StatesModel.findById(userProfileUpdateDto.state);
    //   userProfileUpdateDto.state = state.name;
    // }

    let updatedUser: UserDocument = await this.UserModel.findOneAndUpdate(
      { _id: userId },
      userProfileUpdateDto,
      { new: true },
    );
    loggers.info('updated record......... %O', updatedUser);
    if (!updatedUser) {
      throw new HttpException(
        'There is no user exist with given credentials',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.UserModel.populate(
      [updatedUser],
      [{ path: 'state' }, { path: 'city' }, { path: 'country' }],
    );

    return {
      success: true,
      msg: 'user updated successfuly',
      data: updatedUser,
    };
  }

  async updateStatusAndNotification(
    userStatusAndNotification:
      | UserStatusAndNotificationDto
      | UserStatusAndNotificationAdminDto,
    userId: string,
  ) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }
    let updatedUser: UserDocument = await this.UserModel.findOneAndUpdate(
      { _id: userId },
      userStatusAndNotification,
      { new: true },
    );
    if (!updatedUser) {
      throw new HttpException(
        "This user doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      success: true,
      msg: 'status updated successfuly',
      data: updatedUser,
    };
  }

  userExist(_id: string) {
    return this.UserModel.findById(_id);
  }

  async softDelete(userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }

    // let deletedUser:UserDocument=await this.UserModel.findOne({_id:userId});
    // await deletedUser.softDelete();

    let deletedUser: UserDocument = await this.UserModel.findOneAndUpdate(
      { _id: userId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
    if (!deletedUser) {
      throw new HttpException(
        "This is already deleted or doesn't exist",
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      msg: 'Successfuly deleted the user',
      data: deletedUser,
    };
  }

  async remove(userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }

    await this.UserModel.findOneAndDelete({ _id: userId });

    return;
  }

  async uploadImage(file: Express.Multer.File) {
    return {
      success: true,
      data: 'upload/' + file.filename,
    };
  }

  async updateContactInfo(admin: UserDocument, _id, info) {
    let query = {};
    if (info.name) query['adminContactInfo.$.name'] = info.name;
    if (info.link) query['adminContactInfo.$.link'] = info.link;
    if (info.icon) query['adminContactInfo.$.icon'] = info.icon;

    let doc: UserDocument = await this.UserModel.findOneAndUpdate(
      { _id: admin._id, 'adminContactInfo._id': _id },
      {
        $set: query,
      },
      { new: true },
    ).lean();

    return {
      success: true,
      data: doc?.adminContactInfo,
    };
  }

  async deleteContactInfo(admin: UserDocument, _id) {
    let query = {};

    let doc: UserDocument = await this.UserModel.findOneAndUpdate(
      { _id: admin._id },
      {
        $pull: {
          adminContactInfo: {
            _id,
          },
        },
      },
      { new: true },
    ).lean();

    return {
      success: true,
      data: doc?.adminContactInfo,
    };
  }
}
