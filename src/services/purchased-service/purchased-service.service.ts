import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { PayStackService } from '@src/paystack/paystack.service';
import { PurchasingType } from '@src/paystack/paystack.types';
import { SocketGateway } from '@src/socket/socket.gateway';
import moment from 'moment';
import * as path from 'path';
import { ServiceSharedService } from '../Shared/shared.services.service';
import { UsersService } from 'src/users/users.service';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';
import { AdminGetServicesDataDto } from './dto/admin.purchased-sercvices.dto';

const PURCHASED_SERVICE_INCLUDE = {
  user: { include: { country: true, city: true, state: true } },
  service: { include: { category: true, vendor: true } },
  payment: true,
};

export class CreatePurchasedServicePaystackDto {
  serviceId: string;
  totalPersons?: number;
  date?: string;
}

@Injectable()
export class PurchasedServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesSharedService: ServiceSharedService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly payStackService: PayStackService,
  ) {
    // Register this service as the service webhook handler
    this.payStackService.purchasedServiceHandler = this;
  }

  async purchase(dto: CreatePurchasedServicePaystackDto, userId: string) {
    const service = await this.servicesSharedService.helperServiceFindById(dto.serviceId);
    if (!service) throw new HttpException('Service not found', HttpStatus.BAD_REQUEST);

    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);

    const totalPersons = dto.totalPersons ?? 1;
    const totalPrice = Number(service.price) * totalPersons;

    const metadata = {
      purchasingType: PurchasingType.PURCHASED_SERVICE,
      serviceId: dto.serviceId,
      totalPerson: totalPersons,
      price: String(service.price),
      totalPrice: String(totalPrice),
      userId,
      date: dto.date ? new Date(dto.date) : new Date(),
    };

    const paymentIntent = await this.payStackService.createPaymentIntent({
      email: user.email,
      amount: Math.round(totalPrice),
      metaData: metadata,
    });

    return { success: true, data: paymentIntent };
  }

  async createPurchasedService(metadata: any, paystackReference: string) {
    const existing = await this.prisma.payment.findUnique({ where: { paystackReference } });
    if (existing) return;

    const service = await this.servicesSharedService.helperServiceFindById(metadata.serviceId);
    if (!service) return;

    const totalPersons = metadata.totalPerson ?? 1;
    const totalPrice = Number(service.price) * totalPersons;

    const payment = await this.prisma.payment.create({
      data: {
        userId: metadata.userId,
        paystackReference,
        paymentStatus: 'SUCCEEDED',
        paymentMethod: 'PAYSTACK',
        totalPrice: new Decimal(totalPrice),
        perItemPrice: new Decimal(service.price),
        noOfItems: totalPersons,
        isPaid: true,
        isAvailable: false,
      },
    });

    const purchasedService = await this.prisma.purchasedService.create({
      data: {
        serviceId: metadata.serviceId,
        userId: metadata.userId,
        paymentId: payment.id,
        quantity: totalPersons,
        date: metadata.date ? new Date(metadata.date) : new Date(),
      },
    });

    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });
    const user = await this.userService.findOne({ id: metadata.userId });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.SERVICE,
        orderModel: 'PurchasedService',
        orderPayload: purchasedService.id,
        body: `A new Service has been purchased by ${user?.name}.`,
      } as any);

      SocketGateway.emitEvent('notification', {
        notificationType: NotificationType.SERVICE,
        body: `A new Service has been purchased by ${user?.name}.`,
        orderPayload: purchasedService.id,
        _id: (notification as any)?.id,
      }, admin?.id);
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [admin?.email, user?.email].filter(Boolean),
          subject: 'New Service Purchased',
          attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD,YYYY'),
          userEmail: user?.email,
          userName: user?.name,
          productId: service.id,
          productTitle: service.name,
          total: totalPrice,
          subTotal: Number(service.price),
          noOfItems: totalPersons,
          productImage: service.photos?.[0],
          orderType: 'Service',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }
  }

  async getPurchasedServices(getServicesDataDto: GetServicesDataDto | AdminGetServicesDataDto, userId?: string) {
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

    if (purchasedServices.length === 0) return { success: false, msg: 'No services purchased yet', data: [] };

    return {
      success: true,
      msg: 'Purchased services fetched successfully',
      data: purchasedServices,
      page,
      limit,
      totalPages: Math.ceil(purchasedServicesCount / limit),
    };
  }

  async getPurchasedService(id: string, userId?: string) {
    const where: any = { id };
    if (userId) where.userId = userId;

    const purchasedData = await this.prisma.purchasedService.findFirst({
      where,
      include: PURCHASED_SERVICE_INCLUDE,
    });

    if (!purchasedData) throw new HttpException('Purchased service not found', HttpStatus.BAD_REQUEST);
    return { success: true, msg: 'Purchased service fetched successfully', data: purchasedData };
  }
}
