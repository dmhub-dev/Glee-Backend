import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreatePurchasedServiceDto } from './dto/create-purchased-service.dto';
import {
  PaymentMethods,
  PaymentService,
} from './../../payment/payment.service';
import { UsersService } from 'src/users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import {
  PurchasedService,
  PurchasedServiceDocument,
} from 'src/schemas/purchased-service.schema';
import { FilterQuery, Model } from 'mongoose';
import { ServiceSharedService } from './../Shared/shared.services.service';
import {
  ServiceDocument,
  serviceMinorDetails,
} from 'src/schemas/services.schema';
import {
  adminGetRequestEventManagementUser,
  UserDocument,
} from 'src/schemas/user.shema';
import { PaymentDocument } from 'src/schemas/payment.schema';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';
import { AdminGetServicesDataDto } from './dto/admin.purchased-sercvices.dto';
import * as mongoose from 'mongoose';
import { eventMinorDetails } from '../../schemas/events.schema';
import { Role } from '@src/schemas/enums/role';
import { SocketGateway } from '@src/socket/socket.gateway';
import * as path from 'path';
import * as moment from 'moment';
import { loggers } from '@src/interceptors/logger.enums';
import { EmailService } from '@src/email-server/email.service';
import { NotificationType } from '@src/schemas/enums/notification-enum';
import { PurchasedBooking } from '@src/schemas/purchased-booking.schema';
import { NotificationDocument } from '@src/schemas/notification.schema';
import { NotificationService } from '@src/notification/notification.service';

@Injectable()
export class PurchasedServiceService {
  constructor(
    private readonly ServicesSharedService: ServiceSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    @InjectModel(PurchasedService.name)
    private readonly PurchasedServiceModel: Model<PurchasedServiceDocument>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async purchase(
    createPurchasedServiceDto: CreatePurchasedServiceDto,
    userId: string,
    expMonth: string,
    expYear: string,
  ) {
    let totalPriceCalculated: number;
    let service: any = await this.ServicesSharedService.helperServiceFindById(
      createPurchasedServiceDto.serviceId,
    );
    if (!service) {
      throw new HttpException('Service not find...', HttpStatus.BAD_REQUEST);
    }
    let user: UserDocument = await this.userService.findOne({ _id: userId });
    if (!user) {
      throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);
    }

    let admin: UserDocument = await this.userService.findOne({
      role: Role.ADMIN,
    });
    let commission = 0;
    if (
      admin?.margin &&
      typeof +`${admin.margin}` === 'number' &&
      !Number.isNaN(admin.margin)
    )
      commission = admin.margin;

    totalPriceCalculated =
      service.price * createPurchasedServiceDto.totalPersons * 100; // multiply by hundred due to stripe take price in cent and 1 cent equal to 100;
    let { status: result, id } = await this.paymentService.createPaymentCharges(
      PaymentMethods.ONE_TIME,
      {
        amount: totalPriceCalculated,
        currency: 'USD',
        receipt_email: user.email,
        description: `Stripe charge of Amount ${totalPriceCalculated} for One Time Payment`,
      },
      {
        cardDetails: {
          number: createPurchasedServiceDto.number,
          exp_month: expMonth,
          exp_year: expYear,
          cvc: createPurchasedServiceDto.cvc,
          address_state: createPurchasedServiceDto.addressState,
          address_zip: createPurchasedServiceDto.addressZip,
        },
      },
    );

    if (result == 'failed') {
      throw new HttpException('payment failed...', HttpStatus.BAD_REQUEST);
    }
    if (result == 'pending') {
      return {
        success: true,
        status: 'pending',
      };
    }

    let payment: PaymentDocument =
      await this.paymentService.helperCreatePayment({
        transactionId: id,
        bankAccountNumber: createPurchasedServiceDto.number,
        paymentStatus: result,
        noOfItems: createPurchasedServiceDto.totalPersons,
        totalPrice: totalPriceCalculated * 0.01,
        perItemPrice: service.price,
      });

    let purchasedService: PurchasedServiceDocument =
      await this.PurchasedServiceModel.create({
        serviceId: createPurchasedServiceDto.serviceId,
        userId: user._id,
        paymentId: payment._id,
        date: createPurchasedServiceDto.date,
        commission,
      });

    const dataToSend = await this.PurchasedServiceModel.populate(
      [purchasedService],
      [
        { path: 'paymentId' },
        {
          path: 'serviceId',
          select: {
            ...serviceMinorDetails,
            category: 1,
          },
          populate: {
            path: 'category',
            select: {
              name: 1,
            },
          },
        },
      ],
    );

    // noinspection DuplicatedCode

    const notification = await this.notificationService.addNotification({
      notificationType: NotificationType.SERVICE,
      orderModel: PurchasedBooking.name,
      orderPayload: purchasedService._id.toString(),
      body: `A new Service has been purchased by ${user.name}.`,
    } as NotificationDocument);

    SocketGateway.emitEvent(
      'notification',
      {
        notificationType: NotificationType.SERVICE,
        body: `A new Service has been purchased by ${user.name}.`,
        orderPayload: purchasedService._id,
        _id: notification._id,
      },
      admin._id.toString(),
    );

    const responseEmail = await this.emailService.sendMail({
      template: 'event-ticket',
      message: {
        to: [admin.email, service.vendor?.email, user?.email],
        subject: 'New Service Ticket Purchased',
        attachments: [
          {
            filename: 'logo.svg',
            path: path.join(process.cwd(), 'views', 'logo.svg'),
            cid: 'logo',
          },
        ],
      },
      locals: {
        purchasedOn: moment().format('MMMM DD,YYYY'),
        userEmail: user.email,
        userName: user.name,
        productId: service?._id,
        productTitle: service.name,
        total: payment.totalPrice,
        subTotal: payment.perItemPrice,
        noOfItems: payment.noOfItems,
        productImage: service.photos[0],
        orderType: 'Service',
      },
    });
    loggers.info('Email Response:::: %O', responseEmail);

    return {
      success: 'true',
      msg: 'service purchased successfuly',
      data: dataToSend,
    };
  }

  async getPurchasedServices(
    getServicesDataDto: GetServicesDataDto | AdminGetServicesDataDto,
    userId?: string,
  ) {
    const { page, limit } = getServicesDataDto;
    let totalPages: number;
    let query: FilterQuery<PurchasedServiceDocument> = {
      isDeleted: false,
      deletedAt: null,
    };

    if (userId) query.userId = userId;
    if (getServicesDataDto?.serviceId)
      query.serviceId = getServicesDataDto.serviceId;

    const purchasedServicesCount: number =
      await this.PurchasedServiceModel.find(query).count();
    totalPages = Math.ceil(purchasedServicesCount / limit);
    const purchasedServices: PurchasedServiceDocument[] =
      await this.PurchasedServiceModel.find(query)
        .populate({
          path: 'userId',
          select: adminGetRequestEventManagementUser,
          populate: [
            { path: 'country', select: { name: 1, isoCode: 1 } },
            {
              path: 'city',
              select: {
                isoCode: 1,
                name: 1,
                _id: 1,
                countryCode: 1,
                stateCode: 1,
              },
            },
            {
              path: 'state',
              select: { isoCode: 1, name: 1, _id: 1, countryCode: 1 },
            },
          ],
        })
        .populate({
          path: 'serviceId',
          populate: [
            {
              path: 'category',
            },
            {
              path: 'vendor',
              select: {
                name: 1,
              },
            },
          ],
        })
        .populate('paymentId')
        .skip((page - 1) * limit)
        .limit(limit);
    if (purchasedServices.length == 0) {
      return {
        success: false,
        msg: 'not any service purchased yet',
        data: [],
      };
    }
    return {
      success: true,
      msg: 'purchased services fetched successfuly',
      data: purchasedServices,
      page,
      limit,
      totalPages,
    };
  }

  async getPurchasedService(id: string, userId: string = null) {
    if (
      (!userId && !mongoose.isValidObjectId(userId)) ||
      !mongoose.isValidObjectId(id)
    ) {
      throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);
    }
    let query: FilterQuery<PurchasedServiceDocument> = {
      _id: id,
    };

    if (userId) {
      query.isDeleted = false;
      query.userId = userId;
    }

    let purchasedData = await this.PurchasedServiceModel.findOne({
      ...query,
    })
      .populate('paymentId')
      .populate({
        path: 'serviceId',
        populate: [
          {
            path: 'category',
          },
          {
            path: 'vendor',
            select: {
              name: 1,
            },
          },
        ],
      });
    if (!purchasedData) {
      throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);
    }
    return {
      success: true,
      msg: 'purchased service fetched successfuly',
      data: purchasedData,
    };
  }
}
