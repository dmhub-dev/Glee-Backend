import { Injectable, HttpException, HttpStatus, Req } from '@nestjs/common';
import {
  LoginDto,
  ForgotPassword,
  PasswordReset,
  RegisterUserDto,
  VerifyOtpDto,
  RegisterVendorDto,
  LoginVendorDto,
} from './dto/create-auth.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  userInternalUsedFields,
  userPublicFields,
  User,
  UserDocument,
  userPrivateFields,
} from '../schemas/user.shema';
import { FilterQuery, Model, QueryOptions } from 'mongoose';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import otpTemplate from '../template/mail/signup-otp';
import passwordOtpTemplate from '../template/mail/otp-mail';
import emailVerifyTemplate from '../template/mail/email-verify';
import mailer from '../config/mail';
import { Response, ResponseObj } from '../shared/response';
import { encrypt, generateOtp, populateStateData } from '../shared/utils';
import { ConfigService } from '@nestjs/config';
import accountCreation from 'src/template/mail/account-creation';
import {
  Notification,
  NotificationDocument,
} from 'src/schemas/notification.schema';
import { Countries, CountriesDocument } from '@src/schemas/countries.schema';
import { Cities, CitiesDocument } from '@src/schemas/cities.schema';
import { States, StatesDocument } from '@src/schemas/states.schema';
import { loggers } from '@src/interceptors/logger.enums';
import { OnesignalService } from '@src/onesignal/onesignal.service';
import { Role } from '@src/schemas/enums/role';
import { EmailService } from '@src/email-server/email.service';
import * as path from 'path';
import * as moment from 'moment';
import { VendorDocument } from '@src/schemas/vendor.schema';
import { VendorService } from '@src/vendor/vendor.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Countries.name)
    private CountriesModel: Model<CountriesDocument>,
    @InjectModel(Cities.name)
    private CitiesModel: Model<CitiesDocument>,
    @InjectModel(States.name)
    private StatesModel: Model<StatesDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly oneSignalService: OnesignalService,
    public configService: ConfigService,
    private emailService: EmailService,
    private vendorService: VendorService,

  ) {}

  async getCitiesOfStateList(filter) {
    let page = filter.page || 1;
    let limit = filter.limit || 5;

    const options: QueryOptions = {};

    if (!filter.skipPagination) {
      options['skip'] = (filter.page - 1) * filter.limit;
      options['limit'] = filter.limit;
    }

    if (filter.name) options['sort'] = { score: { $meta: 'textScore' } };

    let query: FilterQuery<CountriesDocument> = {
      countryCode: filter.countryCode,
    };

    if (filter.stateCode) query.stateCode = filter.stateCode;

    if (filter.name) {
      query.$text = {
        $search: filter.name,
        $caseSensitive: false,
      };
    }

    const count = await this.CitiesModel.find(query, {
      name: 1,
      countryCode: 1,
      stateCode: 1,
    }).count();

    const cities = await this.CitiesModel.find(
      query,
      { name: 1, countryCode: 1, stateCode: 1 },
      options,
    ).sort('name');

    return {
      success: true,
      data: cities,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getStateOfCountryList(filter) {
    let page = filter.page || 1;
    let limit = filter.limit || 5;

    const options: QueryOptions = {};

    if (!filter.skipPagination) {
      options['skip'] = (page - 1) * limit;
      options['limit'] = limit;
    }

    if (filter.name) options['sort'] = { score: { $meta: 'textScore' } };

    let query: FilterQuery<CountriesDocument> = {
      countryCode: filter.countryCode,
    };

    if (filter.name) {
      query.$text = {
        $search: filter.name,
        $caseSensitive: false,
      };
    }
    const count = await this.StatesModel.find(query, {
      name: 1,
      isoCode: 1,
      countryCode: 1,
    }).count();
    const states = await this.StatesModel.find(
      query,
      { name: 1, isoCode: 1, countryCode: 1 },
      options,
    ).sort('name');
    return {
      success: true,
      data: states,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getCountryList(filter) {
    let page = filter.page || 1;
    let limit = filter.limit || 5;
    const options: QueryOptions = {};

    let responseData = { success: false };

    if (filter.name) options['sort'] = { score: { $meta: 'textScore' } };
    let query: FilterQuery<CountriesDocument> = {};

    if (filter.name) {
      query.$text = {
        $search: filter.name,
        $caseSensitive: false,
      };
    }
    if (!filter.skipPagination) {
      options['skip'] = (page - 1) * limit;
      options['limit'] = limit;
      const count = await this.CountriesModel.count(query);
      responseData['page'] = page;
      responseData['limit'] = limit;
      responseData['totalPages'] = Math.ceil(count / limit);
    }
    let countries = await this.CountriesModel.find(
      query,
      { name: 1, isoCode: 1 },
      options,
    ).sort('name');

    responseData['data'] = countries;
    responseData['success'] = true;
    return responseData;
  }

  /**
   * Service: Register
   * -----------------
   * @param userDto
   * @param req
   */
  async register(userDto: RegisterUserDto, file?: Express.Multer.File) {
    try {
      const admin = await this.userModel
        .findOne({ role: Role.ADMIN })
        .select('email');
      const userInDb = await this.usersService.findOne(
        {
          email: userDto.email,
        },
        { ...userInternalUsedFields },
      );

      if (userInDb) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }

      if (file) {
        userDto.profileImage = `${this.configService.get('APP_URL')}/upload/${
          file.filename
        }`;
      }
      let user: UserDocument = await this.usersService.create(userDto);
      const config = this.configService.get('EMAIL_SMTP');
      await this.emailService.sendMail({
        template: 'new-account',
        message: {
          to: admin.email,
          subject: 'New Account Creation',
          attachments: [
            {
              filename: 'logo.svg',
              path: path.join(process.cwd(), 'views', 'logo.svg'),
              cid: 'logo',
            },
          ],
        },
        locals: {
          config,
          message: `${userDto.name} has registered in Glee App.`,
          linkText: 'Please visit the dashboard',
          link: 'https://glee-admin.appnofy.com/user-management',
          name: 'Admin',
          date: new Date().getFullYear(),
        },
      });
      await this.emailService.sendMail({
        template: 'new-account',
        message: {
          to: userDto.email,
          subject: 'New Account Creation',
          attachments: [
            {
              filename: 'logo.svg',
              path: path.join(process.cwd(), 'views', 'logo.svg'),
              cid: 'logo',
            },
          ],
        },
        locals: {
          config,
          message: `Congratulations, ${userDto.name} your account has been created.`,
          name: userDto.name,
          date: new Date().getFullYear(),
        },
      });

      return {
        success: true,
        message: 'User registered successfully',
        data: user.toPublicData(),
      };
    } catch (err) {
      if (err.code === 11000) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }
      loggers.info(err);
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Something went wrong.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Service: Login
   * --------------
   * @param loginUserDto
   * @param type
   */
  async login(loginUserDto: LoginDto) {
    try {
      const user = await this.usersService.findByLogin(loginUserDto);
      if (user.role === Role.USER) {
        const oneSignalResponse =
          await this.oneSignalService.addUserToNotificationList(
            user._id.toString(),
            loginUserDto.playerId,
          );

        if (!oneSignalResponse.success)
          throw new HttpException(
            oneSignalResponse.message,
            HttpStatus.BAD_REQUEST,
          );
        else
          return {
            success: true,
            data: {
              ...user,
              oneSignalData: oneSignalResponse.data,
            },
          };
      }
      return user;
    } catch (err) {
      if (err.status === 401)
        throw new HttpException(err.message, HttpStatus.UNAUTHORIZED);
      if (err instanceof HttpException) throw err;
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Service: Forgot Password
   * ------------------------
   * @param forgotPasswordDto
   * @param isRegister
   */
  async forgotPassword(forgotPasswordDto: ForgotPassword): Promise<Response> {
    try {
      forgotPasswordDto.otp = generateOtp();
      const user = await this.usersService.forgotPassword(forgotPasswordDto);
      await this.sendPasswordOtp(user, forgotPasswordDto.otp);
      ResponseObj.success = true;
      ResponseObj.message = `An email has been sent to ${forgotPasswordDto.email} with verification pin`;
      ResponseObj.data = {};
      return ResponseObj;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Something went wrong. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Service: Reset Password
   * -----------------------
   * @param payload
   */
  async resetPassword(payload: PasswordReset): Promise<Response> {
    try {
      const user = await this.userModel
        .findOne({ email: payload.email })
        .lean();
      await this.usersService.resetPassword(payload);
      const config = this.configService.get('EMAIL_SMTP');
      await this.emailService.sendMail({
        template: 'confirmation-email',
        message: {
          to: payload.email,
          subject: 'GLEE App Alert',
          attachments: [
            {
              filename: 'logo.svg',
              path: path.join(process.cwd(), 'views', 'logo.svg'),
              cid: 'logo',
            },
          ],
        },
        locals: {
          config,
          user,
          date: new Date().getFullYear(),
        },
      });
      ResponseObj.success = true;
      ResponseObj.message = `Password reset successfully`;
      ResponseObj.data = {};
      return ResponseObj;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw err;
    }
  }

  /**
   * Service: Reset Password
   * -----------------------
   * @param payload
   */
  async verifyOtpService(payload: VerifyOtpDto): Promise<Response> {
    try {
      return this.usersService.verifyOtp(payload);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Something went wrong. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Method: testAuth
   * ................
   */
  async testAuth(user: UserDocument) {
    const data = user.toPublicData();
    const users = await this.userModel.populate(
      [data],
      [{ path: 'state' }, { path: 'city' }, { path: 'country' }],
    );
    return {
      success: true,
      data: users[0],
    };
  }

  /**
   * Method: Validator
   * .................
   * @param payload
   */
  async validateUser(payload): Promise<RegisterUserDto> {
    const user = await this.usersService.findByPayload(payload, {
      ...userPublicFields,
      ...userPrivateFields,
    });
    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    return user;
  }

  /**
   * Method: User Exist
   * ..................
   * @param email
   */
  async userExists({ email }) {
    try {
      const user = await this.usersService.findOne(
        { email },
        { ...userPublicFields },
      );
      if (!user) {
        return {
          success: true,
          message: "User doesn't exist",
          data: { isUserExists: false },
        };
      }
      return {
        success: true,
        message: 'User Exists',
        data: { isUserExists: true },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Something went wrong. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Method: Sending Sign Up OTP
   * ...........................
   * @param user
   * @param otp
   * @private
   */
  private sendSignupOtp(user, otp) {
    const config = this.configService.get('EMAIL_SMTP');
    const mailData = {
      from: config.MAIL_FROM_ADDRESS,
      to: user.email,
      subject: `${user.name}, here's your PIN | ${config.APP_NAME}`,
      html: otpTemplate(global.app_url, { name: user.name, otp }, config),
    };

    mailer(mailData, config, (response) => {
      if (response.success) {
        return {
          message: 'Account verification mail sent successfully',
          success: true,
        };
      } else {
        return new Error('Unable to send verification email');
      }
    });
  }

  /**
   * Method: Sending Verification OTP
   * ................................
   * @param user
   * @param otp
   * @param req
   * @private
   */
  private async sendVerificationEmail(user, otp, req) {
    const config = this.configService.get('EMAIL_SMTP');
    const ciphertext = encrypt('' + otp);
    const mailData = {
      from: config.MAIL_FROM_ADDRESS,
      to: user.email,
      subject: `${user.name}, here's your verification link | ${config.APP_NAME}`,
      html: emailVerifyTemplate(
        req.appUrl,
        {
          name: user.name,
          email: user.email,
          otp: ciphertext,
        },
        config,
      ),
    };

    mailer(mailData, config, (response) => {
      if (response.success) {
        return {
          message: 'Account verification mail sent successfully',
          success: true,
        };
      } else {
        return new Error('Unable to send verification email');
      }
    });
  }

  /**
   * Method: Account Creation Notification
   * .....................................
   * @param user
   * @param email
   * @param subject
   * @param message
   * @private
   */
  private async accountCreationNotification(user, email, subject, message) {
    const config = this.configService.get('EMAIL_SMTP');
    const mailData = {
      from: config.MAIL_FROM_ADDRESS,
      to: email,
      subject: `${subject} | ${config.APP_NAME}`,
      html: accountCreation(
        {
          name: user.name,
          email: user.email,
        },
        config,
        message,
      ),
    };

    mailer(mailData, config, (response) => {
      if (response.success) {
        return {
          message: 'Account verification mail sent successfully',
          success: true,
        };
      } else {
        return new Error('Unable to send verification email');
      }
    });
  }

  /**
   * Method: Sending Password OTP
   * ............................
   * @param user
   * @param otp
   * @private
   */
  private async sendPasswordOtp(user, otp) {
    const config = this.configService.get('EMAIL_SMTP');

    await this.emailService.sendMail({
      template: 'forget-pass',
      message: {
        to: user.email,
        subject: 'GLEE OTP Alert',
        attachments: [
          {
            filename: 'logo.svg',
            path: path.join(process.cwd(), 'views', 'logo.svg'),
            cid: 'logo',
          },
        ],
      },
      locals: {
        config,
        user,
        date: new Date().getFullYear(),
        otp,
      },
    });
    // const mailData = {
    //   from: config.MAIL_FROM_ADDRESS,
    //   to: user.email,
    //   subject: `${user.name}, here's your PIN | ${config.APP_NAME}`,
    //   html: passwordOtpTemplate(
    //     global.app_url,
    //     { name: user.name, otp },
    //     config,
    //   ),
    // };
    //
    // mailer(mailData, config, (response) => {
    //   if (response.success) {
    //     return { message: 'OTP mail sent successfully', success: true };
    //   } else {
    //     return new Error('Unable to send otp email');
    //   }
    // });
  }

  /**
   * Method: Vendor SignUp
   * ............................
   * @param user
   * @param otp
   * @private
   */


  async registerVendor(registerVendorDto: RegisterVendorDto, file?: Express.Multer.File) {
    try {
      const admin = await this.userModel
        .findOne({ role: Role.ADMIN })
        .select('email');
      const userInDb = await this.usersService.findOne(
        {
          email: registerVendorDto.email,
          role:Role.VENDOR

        },
        { ...userInternalUsedFields },
      );

      if (userInDb) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }

      if (file) {
        registerVendorDto.profileImage = `${this.configService.get('APP_URL')}/upload/${
          file.filename
        }`;
      }
      const createVendor = await this.vendorService.createVendor(registerVendorDto, file);
      
      let user: UserDocument = await this.usersService.createVendorAuth(registerVendorDto,createVendor._id);

      const config = this.configService.get('EMAIL_SMTP');
      await this.emailService.sendMail({
        template: 'new-account',
        message: {
          to: admin.email,
          subject: 'New Account Creation',
          attachments: [
            {
              filename: 'logo.svg',
              path: path.join(process.cwd(), 'views', 'logo.svg'),
              cid: 'logo',
            },
          ],
        },
        locals: {
          config,
          message: `${registerVendorDto.username} has registered in Glee App.`,
          linkText: 'Please visit the dashboard',
          link: 'https://glee-admin.appnofy.com/user-management',
          name: 'Admin',
          date: new Date().getFullYear(),
        },
      });
      await this.emailService.sendMail({
        template: 'new-account',
        message: {
          to: registerVendorDto.email,
          subject: 'New Account Creation',
          attachments: [
            {
              filename: 'logo.svg',
              path: path.join(process.cwd(), 'views', 'logo.svg'),
              cid: 'logo',
            },
          ],
        },
        locals: {
          config,
          message: `Congratulations, ${registerVendorDto.username} your account has been created.`,
          name: registerVendorDto.username,
          date: new Date().getFullYear(),
        },
      });

      return {
        success: true,
        message: 'Vendor registered successfully',
        data: user.toPublicData(),
      };
    } catch (err) {
      if (err.code === 11000) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }
      loggers.info(err);
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Something went wrong.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /**
   * Method: Vendor Login
   * ............................
   * @param user
   * @param otp
   * @private
   */

  async loginVendor(loginVendorDto: LoginVendorDto) {
    try {
      const user = await this.usersService.findByVendorLogin(loginVendorDto);
      return user;
    } catch (err) {
      if (err.status === 401)
        throw new HttpException(err.message, HttpStatus.UNAUTHORIZED);
      if (err instanceof HttpException) throw err;
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getRoleByAuth(loginUserDto: LoginDto) {
    const user = await this.usersService.getRoleByAuth(loginUserDto);
    return user;
  }
}
