import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/user.create.dto';
import { LoginUserDto } from './dto/user-login.dto';
import { comparePasswords } from '../shared/utils';
import { Model } from 'mongoose';
import {
  UserDocument,
  User,
  userPublicFields,
  userInternalUsedFields,
} from '../schemas/user.shema';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { NotificationType } from 'src/schemas/enums/notification-enum';
import {
  NotificationDocument,
  Notification,
} from 'src/schemas/notification.schema';
import { OnesignalService } from 'src/onesignal/onesignal.service';
import { SocketGateway } from 'src/socket/socket.gateway';
import {
  LoginDto,
  LoginVendorDto,
  RegisterUserDto,
  RegisterVendorDto,
  VerifyOtpDto,
} from '../auth/dto/create-auth.dto';
import { IUser, IUserSelectableFields } from '../schemas/interfaces/user';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@src/schemas/enums/role';
import { AccountStatus } from '@src/schemas/enums/status';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private UserModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>, // private readonly onesignalService: OnesignalService,
    private readonly jwtService: JwtService,
  ) {}

  async findOne(
    filter: Partial<IUser>,
    projection?: IUserSelectableFields,
    options?: object,
  ): Promise<UserDocument> {
    return this.UserModel.findOne(filter, projection, options);
  }

  async readChat(id) {
    return this.UserModel.findByIdAndUpdate(id, { isAllChatRead: true });
  }

  async findByLogin({ email, password, role }: LoginDto): Promise<IUser> {
    const user: UserDocument = await this.UserModel.findOne({ email, role })
      .populate('state')
      .populate('city')
      .populate('country');
    if (!user) {
      throw new HttpException('User does not exists', HttpStatus.UNAUTHORIZED);
    }

    const areEqual = await comparePasswords(user.password, password);
    if (!areEqual) {
      throw new HttpException(`Invalid credentials`, HttpStatus.UNAUTHORIZED);
    }

    if (user.isActive == 'INACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.isActive !== 'ACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.role === Role.ADMIN) {
    }

    const token = this._createToken(user);
    user.token = token.accessToken;
    user.profileStatus = true;
    await user.save();

    return user.toAuthData();
  }

  async getRoleByAuth({ email, password }: LoginDto){
    const user: UserDocument = await this.UserModel.findOne({ email })
      .populate('state')
      .populate('city')
      .populate('country');
    if (!user) {
      throw new HttpException('User does not exists', HttpStatus.UNAUTHORIZED);
    }

    const areEqual = await comparePasswords(user.password, password);
    if (!areEqual) {
      throw new HttpException(`Invalid credentials`, HttpStatus.UNAUTHORIZED);
    }

    if (user.isActive == 'INACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.isActive !== 'ACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
}

  async findByVendorLogin({ email, password, role }: LoginVendorDto): Promise<IUser> {
    const user: UserDocument = await this.UserModel.findOne({ email, role })
      .populate('vendor_id')
      .populate('state')
      .populate('city')
      .populate('country');
    if (!user) {
      throw new HttpException('User does not exists', HttpStatus.UNAUTHORIZED);
    }
    console.log("user.vendor_id._id", user.vendor_id._id);
    console.log("user.vendor_id.email", user.vendor_id.email);
    console.log("user.vendor_id.name",user.vendor_id.name);
    
    

    const areEqual = await comparePasswords(user.password, password);
    if (!areEqual) {
      throw new HttpException(`Invalid credentials`, HttpStatus.UNAUTHORIZED);
    }

    if (user.isActive == 'INACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.isActive !== 'ACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = this._createToken(user);
    user.token = token.accessToken;
    user.profileStatus = true;
    await user.save();

    return user.toAuthData();
  }

  async findByPayload(data: any, projection?: any): Promise<any> {
    return await this.findOne(
      { _id: data.userId },
      projection ? projection : { ...userPublicFields },
    );
  }

  async create(userDto: RegisterUserDto): Promise<UserDocument> {
    userDto.password = await bcrypt.hash(userDto.password, 10);
    return await this.UserModel.create(userDto);
  }

  async createVendorAuth(registerVendorDto: RegisterVendorDto,vendor_id:number): Promise<UserDocument> {
    registerVendorDto.password = await bcrypt.hash(registerVendorDto.password, 10);
    const data = {
      name: registerVendorDto.username,
      password: registerVendorDto.password,
      email: registerVendorDto.email,
      role: Role.VENDOR,
      isActive: AccountStatus.INACTIVE,
      vendor_id:vendor_id
    };
    return await this.UserModel.create(data);
  }

  async forgotPassword(data): Promise<any> {
    const userInDb = await this.UserModel.findOne({ email: data.email });
    if (!userInDb) {
      throw new HttpException("User doesn't exists", HttpStatus.BAD_REQUEST);
    }

    const user = this.UserModel.findOneAndUpdate(
      { email: data.email },
      { otp: data.otp },
      { new: true },
    );
    return user;
  }

  async resetPassword(data): Promise<any> {
    let userExists = await this.findOne({ email: data.email });

    if (!userExists) {
      throw new HttpException('Invalid user email', HttpStatus.BAD_REQUEST);
    }

    if (userExists.otp !== data.otp) {
      throw new HttpException(
        { message: 'Invalid OTP', isOtpInvalid: true },
        HttpStatus.BAD_REQUEST,
      );
    }

    const password = await bcrypt.hash(data.password, 10);

    const user: UserDocument = await this.UserModel.findOneAndUpdate(
      { email: data.email },
      { password: password, otp: null },
      { new: true },
    );

    return user.toPublicData();
  }

  async verifyOtp(data: VerifyOtpDto): Promise<any> {
    let userExists = await this.findOne({ email: data.email, otp: data.otp });

    if (!userExists) {
      throw new HttpException(
        { message: 'Invalid OTP', isOtpInvalid: true, success: false, data },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      message: 'Otp has been verified',
      data,
    };
  }

  /**
   * Method: Create Token
   * ....................
   * @param data
   * @private
   */
  private _createToken(data): any {
    const expiresIn = process.env.EXPIRESIN;

    const user = { userId: data._id, email: data.email };
    const accessToken = this.jwtService.sign(user);
    return {
      expiresIn,
      accessToken,
    };
  }
}
