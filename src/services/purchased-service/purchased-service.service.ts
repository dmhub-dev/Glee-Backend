import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { SocketGateway } from '@src/socket/socket.gateway';
import * as moment from 'moment';
import * as path from 'path';
import { ServiceSharedService } from '../Shared/shared.services.service';
import { UsersService } from 'src/users/users.service';
import { PaymentMethods, PaymentService } from '../../payment/payment.service';
import { CreatePurchasedServiceDto } from './dto/create-purchased-service.dto';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';
import { AdminGetServicesDataDto } from './dto/admin.purchased-sercvices.dto';

const PURCHASED_SERVICE_INCLUDE = {
  user: { include: { country: true, city: true, state: true } },
  service: { include: { category: true, vendor: true } },
  payment: true,
};

@Injectable()
export class PurchasedServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesSharedService: ServiceSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async purchase(
    createPurchasedServiceDto: CreatePurchasedServiceDto,
    userId: string,
    expMonth: string,
    expYear: string,
  ) {
    const service = await this.servicesSharedService.helperServiceFindById(createPurchasedServiceDto.serviceId);
    if (!service) throw new HttpException('Service not find...', HttpStatus.BAD_REQUEST);

    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);

    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });

    const totalPriceCalculated = Number(service.price) * createPurchasedServiceDto.totalPersons * 100;

    const { status: result, id } = await this.paymentService.createPaymentCharges(
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

    if (result === 'failed') throw new HttpException('payment failed...', HttpStatus.BAD_REQUEST);
    if (result === 'pending') return { success: true, status: 'pending' };

    const payment = await this.paymentService.helperCreatePayment({
      transactionId: id,
      bankAccountNumber: createPurchasedServiceDto.number,
      paymentStatus: result,
      noOfItems: createPurchasedServiceDto.totalPersons,
      totalPrice: totalPriceCalculated * 0.01,
      perItemPrice: Number(service.price),
    });

    const purchasedService = await this.prisma.purchasedService.create({
      data: {
        serviceId: createPurchasedServiceDto.serviceId,
        userId: user.id,
        paymentId: payment.id,
      },
    });

    const dataToSend = await this.prisma.purchasedService.findFirst({
      where: { id: purchasedService.id },
      include: PURCHASED_SERVICE_INCLUDE,
    });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.SERVICE,
        orderModel: 'PurchasedService',
        orderPayload: purchasedService.id,
        body: `A new Service has been purchased by ${user.name}.`,
      } as any);

      SocketGateway.emitEvent(
        'notification',
        {
          notificationType: NotificationType.SERVICE,
          body: `A new Service has been purchased by ${user.name}.`,
          orderPayload: purchasedService.id,
          _id: (notification as any)?.id ?? (notification as any)?._id,
        },
        admin?.id,
      );
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [admin?.email, (service as any).vendor?.email, user?.email].filter(Boolean),
          subject: 'New Service Ticket Purchased',
          attachments: [
            { filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' },
          ],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD,YYYY'),
          userEmail: user.email,
          userName: user.name,
          productId: service.id,
          productTitle: service.name,
          total: payment.totalPrice,
          subTotal: payment.perItemPrice,
          noOfItems: payment.noOfItems,
          productImage: service.photos?.[0],
          orderType: 'Service',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }

    return { success: 'true', msg: 'service purchased successfuly', data: dataToSend };
  }

  async getPurchasedServices(
    getServicesDataDto: GetServicesDataDto | AdminGetServicesDataDto,
    userId?: string,
  ) {
    const { page, limit } = getServicesDataDto;
    const where: any = {};
    if (userId) where.userId = userId;
    if ((getServicesDataDto as any).serviceId) where.serviceId = (getServicesDataDto as any).serviceId;

    const [purchasedServices, purchasedServicesCount] = await Promise.all([
      this.prisma.purchasedService.findMany({
        where,
        include: PURCHASED_SERVICE_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchasedService.count({ where }),
    ]);

    if (purchasedServices.length === 0) {
      return { success: false, msg: 'not any service purchased yet', data: [] };
    }

    return {
      success: true,
      msg: 'purchased services fetched successfuly',
      data: purchasedServices,
      page,
      limit,
      totalPages: Math.ceil(purchasedServicesCount / limit),
    };
  }

  async getPurchasedService(id: string, userId: string = null) {
    const where: any = { id };
    if (userId) where.userId = userId;

    const purchasedData = await this.prisma.purchasedService.findFirst({
      where,
      include: PURCHASED_SERVICE_INCLUDE,
    });

    if (!purchasedData) throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);

    return { success: true, msg: 'purchased service fetched successfuly', data: purchasedData };
  }
}
