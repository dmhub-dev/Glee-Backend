import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  EntityStatus,
  Prisma,
  ReservationDepositType,
  ReservationPaymentMethod,
  ReservationPaymentStatus,
  ReservationSource,
  ReservationStatus,
  EventStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { PurchasingType } from '@src/infrastructure/payments/paystack/paystack.types';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import {
  CancelReservationDto,
  ConfirmReservationPaymentDto,
  CreateEventReservationSlotDto,
  CreateEventReservationDto,
  CreateLocationTableDto,
  CreateReservationDto,
  CreateReservationSlotDto,
  EventReservationAvailabilityQueryDto,
  ReservationAvailabilityQueryDto,
  ReservationListQueryDto,
  UpdateEventReservationSlotDto,
  UpdateLocationTableDto,
  UpdateReservationStatusDto,
  UpdateReservationSlotDto,
  VenueReservationQueryDto,
} from './dto/reservation.dto';

const RESERVATION_PAYMENT_HOLD_MINUTES = 15;
const RESERVATION_PAYMENT_INIT_FAILURE_MESSAGE =
  'Reservation payment could not be initialized';
const RESERVATION_PAYMENT_WINDOW_EXPIRED_REASON =
  'Reservation payment window expired';
const PAYSTACK_MANUAL_REVIEW_REASON =
  'Payment captured but table is no longer available. Manual refund required.';
const PAYSTACK_EXPIRED_HOLD_MANUAL_REVIEW_REASON =
  'Payment captured after reservation hold expired. Manual refund required.';
const PAYSTACK_NO_LONGER_CONFIRMABLE_MANUAL_REVIEW_REASON =
  'Payment captured after reservation was no longer confirmable. Manual refund required.';
const PAYSTACK_MANUAL_REVIEW_MESSAGE =
  'Reservation payment requires manual review';

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.SEATED,
  ReservationStatus.COMPLETED,
];

const ADMIN_UPDATABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.SEATED,
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
  ReservationStatus.CANCELLED,
];

const RESERVATION_STATUS_TRANSITIONS: Partial<
  Record<ReservationStatus, ReservationStatus[]>
> = {
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.SEATED,
    ReservationStatus.NO_SHOW,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.SEATED]: [
    ReservationStatus.COMPLETED,
    ReservationStatus.CANCELLED,
  ],
};

const PUBLIC_EVENT_RESERVATION_STATUSES: EventStatus[] = [
  EventStatus.ACTIVE,
  EventStatus.LIVE,
  EventStatus.SOLD_OUT,
];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly payStackService: PayStackService,
  ) {
    this.payStackService.reservationHandler = this;
  }

  async confirmReservationPaymentFromPaystack(data: any) {
    const reference = data?.reference;
    if (!reference) {
      throw new BadRequestException('Payment reference is required');
    }

    const payment = await this.prisma.reservationPayment.findFirst({
      where: {
        reference,
        method: ReservationPaymentMethod.PAYSTACK,
      },
      include: {
        reservation: true,
      },
    });

    if (!payment) {
      return undefined;
    }

    if (payment.status === ReservationPaymentStatus.SUCCESS) {
      if (
        this.hasManualReviewRequiredMetadata(payment.metadata) ||
        !ACTIVE_RESERVATION_STATUSES.includes(payment.reservation?.status)
      ) {
        return {
          success: false,
          message: PAYSTACK_MANUAL_REVIEW_MESSAGE,
          data: this.maskPublicReservation(payment.reservation),
        };
      }

      return {
        success: true,
        message: 'Reservation payment already confirmed',
        data: this.maskPublicReservation(payment.reservation),
      };
    }

    if (data.status !== 'success') {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservationPayment.update({
          where: { id: payment.id },
          data: {
            status: ReservationPaymentStatus.FAILED,
            metadata: this.sanitizePaystackPaymentMetadata(data) as any,
          },
        });

        await tx.reservation.updateMany({
          where: {
            id: payment.reservationId,
            status: ReservationStatus.PENDING_PAYMENT,
          },
          data: {
            status: ReservationStatus.CANCELLED,
            cancellationReason: 'Payment was not successful',
          },
        });
      });

      return {
        success: false,
        message: 'Reservation payment was not successful',
        data: this.maskPublicReservation(payment.reservation),
      };
    }

    if (this.isExpiredPendingPaymentHold(payment.reservation)) {
      return this.recordExpiredPaystackHoldReservation(payment, data);
    }

    if (this.requiresNoLongerConfirmablePaystackManualReview(payment)) {
      return this.recordNoLongerConfirmablePaystackReservation(payment, data);
    }

    let reservation: any;
    try {
      reservation = await this.prisma.$transaction(async (tx) => {
        const paymentUpdate = await tx.reservationPayment.updateMany({
          where: {
            id: payment.id,
            status: ReservationPaymentStatus.PENDING,
          },
          data: {
            status: ReservationPaymentStatus.SUCCESS,
            metadata: this.sanitizePaystackPaymentMetadata(data) as any,
          },
        });

        if (paymentUpdate.count === 0) {
          const refreshedPayment = await tx.reservationPayment.findFirst({
            where: { id: payment.id },
            include: {
              reservation: {
                include: this.customerReservationInclude(),
              },
            },
          });

          if (
            refreshedPayment?.status === ReservationPaymentStatus.SUCCESS ||
            refreshedPayment?.reservation?.status === ReservationStatus.CONFIRMED
          ) {
            return refreshedPayment.reservation;
          }

          throw new BadRequestException(
            'Reservation payment cannot be confirmed from its current status',
          );
        }

        const updateResult = await tx.reservation.updateMany({
          where: {
            id: payment.reservationId,
            status: ReservationStatus.PENDING_PAYMENT,
          },
          data: { status: ReservationStatus.CONFIRMED },
        });

        if (updateResult.count === 0) {
          const refreshedReservation = await tx.reservation.findFirst({
            where: { id: payment.reservationId },
            include: this.customerReservationInclude(),
          });

          if (refreshedReservation?.status === ReservationStatus.CONFIRMED) {
            return refreshedReservation;
          }

          throw new BadRequestException(
            'Reservation cannot be confirmed from its current status',
          );
        }

        return tx.reservation.findFirst({
          where: { id: payment.reservationId },
          include: this.customerReservationInclude(),
        });
      });
    } catch (error) {
      if (this.isReservationOverlapError(error)) {
        return this.recordPaystackManualReviewReservation(payment, data);
      }
      throw error;
    }

    return {
      success: true,
      message: 'Reservation payment confirmed successfully',
      data: this.maskPublicReservation(reservation ?? payment.reservation),
    };
  }

  async confirmReservationPayment(dto: ConfirmReservationPaymentDto) {
    if (!dto.verificationToken && !dto.reference) {
      throw new BadRequestException('Payment reference is required');
    }

    const result = dto.verificationToken
      ? await this.payStackService.verifyTransaction(dto.verificationToken)
      : await this.payStackService.verifyTransactionReference(dto.reference!);
    const paystackData = (result as any)?.paystack?.data;

    if (!paystackData?.reference) {
      throw new BadRequestException('Payment verification failed');
    }

    return this.confirmReservationPaymentFromPaystack(paystackData);
  }

  async getPublicReservation(token: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { publicAccessToken: token },
      include: this.customerReservationInclude(),
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      success: true,
      message: 'Reservation retrieved successfully',
      data: this.maskPublicReservation(reservation),
    };
  }

  async listReservationVenues(query: VenueReservationQueryDto = {}) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const search = query.search?.trim();
    const where: Prisma.LocationWhereInput = {
      status: EntityStatus.ACTIVE,
      bookingEnabled: true,
      ...(query.venueType && { venueType: query.venueType }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.location.count({ where }),
    ]);

    return {
      success: true,
      message: 'Reservation venues retrieved successfully',
      data: { items, total, page, limit },
    };
  }

  async getReservationVenue(locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        status: EntityStatus.ACTIVE,
        bookingEnabled: true,
      },
      include: {
        reservationSlots: {
          where: { isActive: true },
          orderBy: { label: 'asc' },
        },
        reservationTables: {
          where: { isActive: true },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Reservation venue not found');
    }

    return {
      success: true,
      message: 'Reservation venue retrieved successfully',
      data: location,
    };
  }

  async getVenueAvailability(
    locationId: string,
    query: ReservationAvailabilityQueryDto,
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || location.status !== EntityStatus.ACTIVE || !location.bookingEnabled) {
      throw new NotFoundException('Reservation venue not found');
    }

    const slot = await this.prisma.reservationSlot.findFirst({
      where: {
        id: query.slotId,
        locationId,
        isActive: true,
      },
    });

    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    this.assertSlotRunsOnDate(query.date, slot.daysOfWeek);
    const { startDateTime, endDateTime } = this.resolveSlotDateTimes(
      query.date,
      slot.startTime,
      slot.endTime,
      location.timezone,
    );

    const tables = await this.prisma.locationTable.findMany({
      where: {
        locationId,
        isActive: true,
        minGuests: { lte: query.guestCount },
        maxGuests: { gte: query.guestCount },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        locationId,
        ...this.activeReservationWhere(),
        startDateTime: { lt: endDateTime },
        endDateTime: { gt: startDateTime },
      },
      select: { tableId: true },
    });

    return {
      success: true,
      message: 'Reservation availability retrieved successfully',
      data: {
        locationId,
        slotId: slot.id,
        startDateTime,
        endDateTime,
        categories: this.groupAvailableTables(tables, reservations),
      },
    };
  }

  async listEventSlots(eventId: string) {
    const event = await this.getPublicEventForRead(eventId);
    if (
      !event.locationId ||
      !event.location ||
      event.location.status !== EntityStatus.ACTIVE ||
      !event.location.bookingEnabled
    ) {
      throw new NotFoundException('Event reservation venue not found');
    }

    const slots = await this.prisma.eventReservationSlot.findMany({
      where: { eventId, isActive: true },
      orderBy: { startDateTime: 'asc' },
    });

    return {
      success: true,
      message: 'Event reservation slots retrieved successfully',
      data: slots,
    };
  }

  async getEventAvailability(
    eventId: string,
    query: EventReservationAvailabilityQueryDto,
  ) {
    const event = await this.getPublicEventForRead(eventId);
    const location = event.location;
    if (
      !event.locationId ||
      !location ||
      location.status !== EntityStatus.ACTIVE ||
      !location.bookingEnabled
    ) {
      throw new NotFoundException('Event reservation venue not found');
    }

    const slot = await this.prisma.eventReservationSlot.findFirst({
      where: {
        id: query.eventSlotId,
        eventId,
        isActive: true,
      },
    });

    if (!slot) {
      throw new NotFoundException('Event reservation slot not found');
    }

    const tables = await this.prisma.locationTable.findMany({
      where: {
        locationId: event.locationId,
        isActive: true,
        minGuests: { lte: query.guestCount },
        maxGuests: { gte: query.guestCount },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        locationId: event.locationId,
        ...this.activeReservationWhere(),
        startDateTime: { lt: slot.endDateTime },
        endDateTime: { gt: slot.startDateTime },
      },
      select: { tableId: true },
    });

    return {
      success: true,
      message: 'Event reservation availability retrieved successfully',
      data: {
        eventId,
        locationId: event.locationId,
        eventSlotId: slot.id,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        categories: this.groupAvailableTables(tables, reservations),
      },
    };
  }

  async createReservation(dto: CreateReservationDto, actor: any): Promise<any> {
    this.assertReservationPayer(dto, actor);

    if (this.isPaystackPayment(dto.paymentMethod)) {
      return this.createPaystackVenueReservation(dto, actor);
    }

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });

    if (!location || location.status !== EntityStatus.ACTIVE || !location.bookingEnabled) {
      throw new NotFoundException('Reservation venue not found');
    }

    const slot = await this.prisma.reservationSlot.findFirst({
      where: {
        id: dto.slotId,
        locationId: dto.locationId,
        isActive: true,
      },
    });

    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    this.assertSlotRunsOnDate(dto.date, slot.daysOfWeek);
    const { startDateTime, endDateTime } = this.resolveSlotDateTimes(
      dto.date,
      slot.startTime,
      slot.endTime,
      location.timezone,
    );
    const reservationDate = this.buildDateTime(dto.date, '00:00', location.timezone);
    const reference = this.generateReservationReference();
    const cancelBefore = new Date(
      startDateTime.getTime() -
        (location.cancellationCutoffHours ?? 24) * 60 * 60 * 1000,
    );

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        await this.cleanupExpiredPendingPaymentReservations(tx, {
          locationId: dto.locationId,
          startDateTime,
          endDateTime,
        });

        const table = await this.pickAvailableTable(tx, {
          locationId: dto.locationId,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime,
          endDateTime,
        });

        const minimumSpend = Math.round(Number(table.minimumSpend));
        const depositAmount = this.calculateDeposit(
          minimumSpend,
          table.depositType,
          Number(table.depositValue),
        );
        const metadata = {
          reservationReference: reference,
          locationId: dto.locationId,
          slotId: dto.slotId,
          tableId: table.id,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        };

        const walletDebit = await this.walletService.debitInTransaction(
          tx,
          actor.id,
          depositAmount,
          `Reservation deposit for ${dto.tableCategory}`,
          reference,
          metadata,
        );

        const createdReservation = await tx.reservation.create({
          data: {
            reference,
            userId: actor.id,
            locationId: dto.locationId,
            tableId: table.id,
            slotId: slot.id,
            reservationDate,
            startDateTime,
            endDateTime,
            guestCount: dto.guestCount,
            tableCategory: dto.tableCategory,
            minimumSpend: new Decimal(minimumSpend),
            depositAmount: new Decimal(depositAmount),
            status: ReservationStatus.CONFIRMED,
            source: ReservationSource.VENUE,
            cancelBefore,
          },
        });

        await tx.reservationPayment.create({
          data: {
            reservationId: createdReservation.id,
            userId: actor.id,
            amount: new Decimal(depositAmount),
            method: ReservationPaymentMethod.WALLET,
            status: ReservationPaymentStatus.SUCCESS,
            reference,
            metadata: {
              ...metadata,
              walletTransactionId: walletDebit.transaction?.id,
            } as any,
          },
        });

        return createdReservation;
      });

      return {
        success: true,
        message: 'Reservation confirmed successfully',
        data: reservation,
      };
    } catch (error) {
      if (this.isReservationOverlapError(error)) {
        throw new BadRequestException('This table category is no longer available');
      }
      throw error;
    }
  }

  private async createPaystackVenueReservation(
    dto: CreateReservationDto,
    actor: any,
  ) {
    const payerEmail = this.resolveReservationEmail(dto, actor);
    if (!payerEmail) {
      throw new BadRequestException('Reservation payer email is required');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });

    if (!location || location.status !== EntityStatus.ACTIVE || !location.bookingEnabled) {
      throw new NotFoundException('Reservation venue not found');
    }

    const slot = await this.prisma.reservationSlot.findFirst({
      where: {
        id: dto.slotId,
        locationId: dto.locationId,
        isActive: true,
      },
    });

    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    this.assertSlotRunsOnDate(dto.date, slot.daysOfWeek);
    const { startDateTime, endDateTime } = this.resolveSlotDateTimes(
      dto.date,
      slot.startTime,
      slot.endTime,
      location.timezone,
    );
    const reservationDate = this.buildDateTime(dto.date, '00:00', location.timezone);
    const reference = this.generateReservationReference();
    const cancelBefore = new Date(
      startDateTime.getTime() -
        (location.cancellationCutoffHours ?? 24) * 60 * 60 * 1000,
    );

    let reservation: any;
    try {
      reservation = await this.prisma.$transaction(async (tx) => {
        await this.cleanupExpiredPendingPaymentReservations(tx, {
          locationId: dto.locationId,
          startDateTime,
          endDateTime,
        });

        const table = await this.pickAvailableTable(tx, {
          locationId: dto.locationId,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime,
          endDateTime,
        });

        const minimumSpend = Math.round(Number(table.minimumSpend));
        const depositAmount = this.calculateDeposit(
          minimumSpend,
          table.depositType,
          Number(table.depositValue),
        );
        const metadata = {
          reservationReference: reference,
          locationId: dto.locationId,
          slotId: dto.slotId,
          tableId: table.id,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        };

        const createdReservation = await tx.reservation.create({
          data: {
            reference,
            userId: actor?.id ?? null,
            guestName: dto.guestName ?? null,
            guestEmail: dto.guestEmail ?? null,
            guestPhone: dto.guestPhone ?? null,
            publicAccessToken: this.generatePublicAccessToken(),
            locationId: dto.locationId,
            tableId: table.id,
            slotId: slot.id,
            reservationDate,
            startDateTime,
            endDateTime,
            guestCount: dto.guestCount,
            tableCategory: dto.tableCategory,
            minimumSpend: new Decimal(minimumSpend),
            depositAmount: new Decimal(depositAmount),
            status: ReservationStatus.PENDING_PAYMENT,
            source: ReservationSource.VENUE,
            cancelBefore,
          },
        });

        await tx.reservationPayment.create({
          data: {
            reservationId: createdReservation.id,
            userId: actor?.id ?? null,
            amount: new Decimal(depositAmount),
            method: ReservationPaymentMethod.PAYSTACK,
            status: ReservationPaymentStatus.PENDING,
            metadata: metadata as any,
          },
        });

        return createdReservation;
      });
    } catch (error) {
      if (this.isReservationOverlapError(error)) {
        throw new BadRequestException('This table category is no longer available');
      }
      throw error;
    }

    const paymentIntent = await this.createAndPersistPaystackPaymentIntent(
      reservation,
      {
        email: payerEmail,
        amount: Math.round(Number(reservation.depositAmount)),
        callbackUrl: dto.callbackUrl,
        metaData: {
          purchasingType: PurchasingType.RESERVATION,
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          source: ReservationSource.VENUE,
          ...(actor?.id && { userId: actor.id }),
          ...(dto.guestName && { guestName: dto.guestName }),
          ...(dto.guestEmail && { guestEmail: dto.guestEmail }),
          ...(dto.guestPhone && { guestPhone: dto.guestPhone }),
        },
      },
    );

    return {
      success: true,
      message: 'Reservation payment initialized successfully',
      data: {
        reservation,
        ...paymentIntent,
      },
    };
  }

  async createEventReservation(
    eventId: string,
    dto: CreateEventReservationDto,
    actor: any,
  ): Promise<any> {
    this.assertReservationPayer(dto, actor);

    if (this.isPaystackPayment(dto.paymentMethod)) {
      return this.createPaystackEventReservation(eventId, dto, actor);
    }

    const event = await this.getPublicEventForRead(eventId);
    const location = event.location;
    if (
      !event.locationId ||
      !location ||
      location.status !== EntityStatus.ACTIVE ||
      !location.bookingEnabled
    ) {
      throw new NotFoundException('Event reservation venue not found');
    }

    const eventSlot = await this.prisma.eventReservationSlot.findFirst({
      where: {
        id: dto.eventSlotId,
        eventId,
        isActive: true,
      },
    });
    if (!eventSlot) {
      throw new NotFoundException('Event reservation slot not found');
    }

    const reference = this.generateReservationReference();

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        const activeEventSlot = await tx.eventReservationSlot.findFirst({
          where: {
            id: eventSlot.id,
            eventId,
            isActive: true,
          },
        });
        if (!activeEventSlot) {
          throw new BadRequestException('Event reservation slot is no longer available');
        }

        const startDateTime = activeEventSlot.startDateTime;
        const endDateTime = activeEventSlot.endDateTime;
        const reservationDate = this.startOfUtcDay(startDateTime);
        const cancelBefore = new Date(
          startDateTime.getTime() -
            (location.cancellationCutoffHours ?? 24) * 60 * 60 * 1000,
        );

        await this.cleanupExpiredPendingPaymentReservations(tx, {
          locationId: event.locationId,
          startDateTime,
          endDateTime,
        });

        const table = await this.pickAvailableTable(tx, {
          locationId: event.locationId,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime,
          endDateTime,
        });

        const minimumSpend = Math.round(Number(table.minimumSpend));
        const depositAmount = this.calculateDeposit(
          minimumSpend,
          table.depositType,
          Number(table.depositValue),
        );
        const metadata = {
          reservationReference: reference,
          eventId,
          eventSlotId: activeEventSlot.id,
          locationId: event.locationId,
          tableId: table.id,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        };

        const walletDebit = await this.walletService.debitInTransaction(
          tx,
          actor.id,
          depositAmount,
          `Event reservation deposit for ${dto.tableCategory}`,
          reference,
          metadata,
        );

        const createdReservation = await tx.reservation.create({
          data: {
            reference,
            userId: actor.id,
            locationId: event.locationId,
            eventId,
            tableId: table.id,
            eventSlotId: activeEventSlot.id,
            reservationDate,
            startDateTime,
            endDateTime,
            guestCount: dto.guestCount,
            tableCategory: dto.tableCategory,
            minimumSpend: new Decimal(minimumSpend),
            depositAmount: new Decimal(depositAmount),
            status: ReservationStatus.CONFIRMED,
            source: ReservationSource.EVENT,
            cancelBefore,
          },
        });

        await tx.reservationPayment.create({
          data: {
            reservationId: createdReservation.id,
            userId: actor.id,
            amount: new Decimal(depositAmount),
            method: ReservationPaymentMethod.WALLET,
            status: ReservationPaymentStatus.SUCCESS,
            reference,
            metadata: {
              ...metadata,
              walletTransactionId: walletDebit.transaction?.id,
            } as any,
          },
        });

        return createdReservation;
      });

      return {
        success: true,
        message: 'Event reservation confirmed successfully',
        data: reservation,
      };
    } catch (error) {
      if (this.isReservationOverlapError(error)) {
        throw new BadRequestException('This table category is no longer available');
      }
      throw error;
    }
  }

  private async createPaystackEventReservation(
    eventId: string,
    dto: CreateEventReservationDto,
    actor: any,
  ) {
    const payerEmail = this.resolveReservationEmail(dto, actor);
    if (!payerEmail) {
      throw new BadRequestException('Reservation payer email is required');
    }

    const event = await this.getPublicEventForRead(eventId);
    const location = event.location;
    if (
      !event.locationId ||
      !location ||
      location.status !== EntityStatus.ACTIVE ||
      !location.bookingEnabled
    ) {
      throw new NotFoundException('Event reservation venue not found');
    }

    const eventSlot = await this.prisma.eventReservationSlot.findFirst({
      where: {
        id: dto.eventSlotId,
        eventId,
        isActive: true,
      },
    });
    if (!eventSlot) {
      throw new NotFoundException('Event reservation slot not found');
    }

    const reference = this.generateReservationReference();

    let reservation: any;
    try {
      reservation = await this.prisma.$transaction(async (tx) => {
        const activeEventSlot = await tx.eventReservationSlot.findFirst({
          where: {
            id: eventSlot.id,
            eventId,
            isActive: true,
          },
        });
        if (!activeEventSlot) {
          throw new BadRequestException('Event reservation slot is no longer available');
        }

        const startDateTime = activeEventSlot.startDateTime;
        const endDateTime = activeEventSlot.endDateTime;
        const reservationDate = this.startOfUtcDay(startDateTime);
        const cancelBefore = new Date(
          startDateTime.getTime() -
            (location.cancellationCutoffHours ?? 24) * 60 * 60 * 1000,
        );
        await this.cleanupExpiredPendingPaymentReservations(tx, {
          locationId: event.locationId,
          startDateTime,
          endDateTime,
        });

        const table = await this.pickAvailableTable(tx, {
          locationId: event.locationId,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime,
          endDateTime,
        });

        const minimumSpend = Math.round(Number(table.minimumSpend));
        const depositAmount = this.calculateDeposit(
          minimumSpend,
          table.depositType,
          Number(table.depositValue),
        );
        const metadata = {
          reservationReference: reference,
          eventId,
          eventSlotId: activeEventSlot.id,
          locationId: event.locationId,
          tableId: table.id,
          tableCategory: dto.tableCategory,
          guestCount: dto.guestCount,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        };

        const createdReservation = await tx.reservation.create({
          data: {
            reference,
            userId: actor?.id ?? null,
            guestName: dto.guestName ?? null,
            guestEmail: dto.guestEmail ?? null,
            guestPhone: dto.guestPhone ?? null,
            publicAccessToken: this.generatePublicAccessToken(),
            locationId: event.locationId,
            eventId,
            tableId: table.id,
            eventSlotId: activeEventSlot.id,
            reservationDate,
            startDateTime,
            endDateTime,
            guestCount: dto.guestCount,
            tableCategory: dto.tableCategory,
            minimumSpend: new Decimal(minimumSpend),
            depositAmount: new Decimal(depositAmount),
            status: ReservationStatus.PENDING_PAYMENT,
            source: ReservationSource.EVENT,
            cancelBefore,
          },
        });

        await tx.reservationPayment.create({
          data: {
            reservationId: createdReservation.id,
            userId: actor?.id ?? null,
            amount: new Decimal(depositAmount),
            method: ReservationPaymentMethod.PAYSTACK,
            status: ReservationPaymentStatus.PENDING,
            metadata: metadata as any,
          },
        });

        return createdReservation;
      });
    } catch (error) {
      if (this.isReservationOverlapError(error)) {
        throw new BadRequestException('This table category is no longer available');
      }
      throw error;
    }

    const paymentIntent = await this.createAndPersistPaystackPaymentIntent(
      reservation,
      {
        email: payerEmail,
        amount: Math.round(Number(reservation.depositAmount)),
        callbackUrl: dto.callbackUrl,
        metaData: {
          purchasingType: PurchasingType.RESERVATION,
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          source: ReservationSource.EVENT,
          eventId,
          eventSlotId: dto.eventSlotId,
          ...(actor?.id && { userId: actor.id }),
          ...(dto.guestName && { guestName: dto.guestName }),
          ...(dto.guestEmail && { guestEmail: dto.guestEmail }),
          ...(dto.guestPhone && { guestPhone: dto.guestPhone }),
        },
      },
    );

    return {
      success: true,
      message: 'Reservation payment initialized successfully',
      data: {
        reservation,
        ...paymentIntent,
      },
    };
  }

  async listMyReservations(
    actor: any,
    query: ReservationListQueryDto = {},
  ) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authentication is required');
    }

    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const where: Prisma.ReservationWhereInput = {
      userId: actor.id,
      ...(query.status && { status: query.status }),
      ...(query.source && { source: query.source }),
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.eventId && { eventId: query.eventId }),
      ...(query.date && { startDateTime: this.buildDateRange(query.date) }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: this.customerReservationInclude(),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDateTime: 'desc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      success: true,
      message: 'Reservations retrieved successfully',
      data: { items, total, page, limit },
    };
  }

  async getMyReservation(id: string, actor: any) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authentication is required');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { id, userId: actor.id },
      include: this.customerReservationInclude(),
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      success: true,
      message: 'Reservation retrieved successfully',
      data: reservation,
    };
  }

  async cancelMyReservation(
    id: string,
    dto: CancelReservationDto = {},
    actor: any,
  ) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authentication is required');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { id, userId: actor.id },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed reservations can be cancelled');
    }
    const now = new Date();
    if (now > new Date(reservation.cancelBefore)) {
      throw new BadRequestException('Reservation can no longer be cancelled');
    }

    const updateResult = await this.prisma.reservation.updateMany({
      where: {
        id,
        userId: actor.id,
        status: ReservationStatus.CONFIRMED,
        cancelBefore: { gt: now },
      },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: now,
        cancelledById: actor.id,
        cancellationReason: dto?.reason ?? null,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Reservation can no longer be cancelled');
    }

    const updated = await this.prisma.reservation.findFirst({
      where: { id, userId: actor.id },
      include: this.customerReservationInclude(),
    });
    if (!updated) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      success: true,
      message: 'Reservation cancelled successfully',
      data: updated,
    };
  }

  async listAdminReservations(
    actor: any,
    query: ReservationListQueryDto = {},
  ) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const where: Prisma.ReservationWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.source && { source: query.source }),
      ...(query.locationId && { locationId: query.locationId }),
      ...(query.eventId && { eventId: query.eventId }),
      ...(query.date && { startDateTime: this.buildDateRange(query.date) }),
    };

    if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(actor?.role)) {
      const vendorId = this.resolveVendorAccountId(actor, true);
      where.OR = [
        { location: { vendorId } },
        { event: { vendorId } },
      ];
    } else if (!this.canManageReservations(actor)) {
      throw new ForbiddenException('You do not have access to manage reservations');
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: this.adminReservationInclude(),
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDateTime: 'asc' },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      success: true,
      message: 'Admin reservations retrieved successfully',
      data: { items, total, page, limit },
    };
  }

  async getAdminReservation(id: string, actor: any) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id },
      include: this.adminReservationInclude(),
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    this.assertCanManageReservationRecord(reservation, actor);

    return {
      success: true,
      message: 'Admin reservation retrieved successfully',
      data: reservation,
    };
  }

  async updateReservationStatus(
    id: string,
    dto: UpdateReservationStatusDto,
    actor: any,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id },
      include: { event: true, location: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    this.assertCanManageReservationRecord(reservation, actor);
    this.assertAdminReservationStatusAllowed(dto.status);
    this.assertReservationStatusTransition(reservation.status, dto.status);

    if (reservation.status === dto.status) {
      return {
        success: true,
        message: 'Reservation status updated successfully',
        data: reservation,
      };
    }

    const now = new Date();
    const updateResult = await this.prisma.reservation.updateMany({
      where: { id, status: reservation.status },
      data: {
        status: dto.status,
        ...((dto.status === ReservationStatus.CANCELLED ||
          dto.status === ReservationStatus.NO_SHOW) && {
          cancellationReason: dto.reason ?? null,
        }),
        ...(dto.status === ReservationStatus.CANCELLED && {
          cancelledAt: now,
          cancelledById: actor?.id,
        }),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException(
        'Reservation status changed. Please refresh and try again',
      );
    }

    const updated = await this.prisma.reservation.findFirst({
      where: { id },
      include: this.adminReservationInclude(),
    });
    if (!updated) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      success: true,
      message: 'Reservation status updated successfully',
      data: updated,
    };
  }

  async createTable(locationId: string, dto: CreateLocationTableDto, actor: any) {
    const location = await this.getLocationForMutation(locationId, actor);
    this.assertValidGuestRange(dto.minGuests, dto.maxGuests);
    this.assertValidDeposit(dto.depositType, dto.depositValue);

    const table = await this.prisma.locationTable.create({
      data: {
        locationId: location.id,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        minGuests: dto.minGuests,
        maxGuests: dto.maxGuests,
        minimumSpend: new Decimal(dto.minimumSpend),
        depositType: dto.depositType,
        depositValue: new Decimal(dto.depositValue),
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Reservation table created successfully',
      data: table,
    };
  }

  async listTables(locationId: string, actor: any) {
    await this.getLocationForRead(locationId, actor);

    const tables = await this.prisma.locationTable.findMany({
      where: { locationId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return {
      success: true,
      message: 'Reservation tables fetched successfully',
      data: tables,
    };
  }

  async updateTable(
    locationId: string,
    tableId: string,
    dto: UpdateLocationTableDto,
    actor: any,
  ) {
    await this.getLocationForMutation(locationId, actor);

    const table = await this.prisma.locationTable.findFirst({
      where: { id: tableId, locationId },
    });
    if (!table) {
      throw new NotFoundException('Reservation table not found');
    }

    const minGuests = dto.minGuests ?? table.minGuests;
    const maxGuests = dto.maxGuests ?? table.maxGuests;
    this.assertValidGuestRange(minGuests, maxGuests);
    this.assertValidDeposit(
      dto.depositType ?? table.depositType,
      dto.depositValue ?? Number(table.depositValue),
    );

    const updated = await this.prisma.locationTable.update({
      where: { id: tableId },
      data: this.buildTableUpdateData(dto),
    });

    return {
      success: true,
      message: 'Reservation table updated successfully',
      data: updated,
    };
  }

  async createSlot(locationId: string, dto: CreateReservationSlotDto, actor: any) {
    const location = await this.getLocationForMutation(locationId, actor);
    this.assertDistinctSlotTimes(dto.startTime, dto.endTime);

    const slot = await this.prisma.reservationSlot.create({
      data: {
        locationId: location.id,
        label: dto.label,
        startTime: dto.startTime,
        endTime: dto.endTime,
        daysOfWeek: dto.daysOfWeek,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Reservation slot created successfully',
      data: slot,
    };
  }

  async listSlots(locationId: string, actor: any) {
    await this.getLocationForRead(locationId, actor);

    const slots = await this.prisma.reservationSlot.findMany({
      where: { locationId },
      orderBy: { label: 'asc' },
    });

    return {
      success: true,
      message: 'Reservation slots fetched successfully',
      data: slots,
    };
  }

  async updateSlot(
    locationId: string,
    slotId: string,
    dto: UpdateReservationSlotDto,
    actor: any,
  ) {
    await this.getLocationForMutation(locationId, actor);

    const slot = await this.prisma.reservationSlot.findFirst({
      where: { id: slotId, locationId },
    });
    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    const startTime = dto.startTime ?? slot.startTime;
    const endTime = dto.endTime ?? slot.endTime;
    this.assertDistinctSlotTimes(startTime, endTime);

    const updated = await this.prisma.reservationSlot.update({
      where: { id: slotId },
      data: this.buildSlotUpdateData(dto),
    });

    return {
      success: true,
      message: 'Reservation slot updated successfully',
      data: updated,
    };
  }

  async createEventSlot(
    eventId: string,
    dto: CreateEventReservationSlotDto,
    actor: any,
  ) {
    const event = await this.getEventForMutation(eventId, actor);
    if (!event.locationId) {
      throw new BadRequestException('Event must have a location for table reservations');
    }

    const startDateTime = new Date(dto.startDateTime);
    const endDateTime = new Date(dto.endDateTime);
    this.assertValidDateRange(startDateTime, endDateTime);
    this.assertEventReservationSlotWithinEvent(event, startDateTime, endDateTime);

    const slot = await this.prisma.eventReservationSlot.create({
      data: {
        eventId: event.id,
        label: dto.label,
        startDateTime,
        endDateTime,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Event reservation slot created successfully',
      data: slot,
    };
  }

  async listAdminEventSlots(eventId: string, actor: any) {
    await this.getEventForMutation(eventId, actor);

    const slots = await this.prisma.eventReservationSlot.findMany({
      where: { eventId },
      orderBy: { startDateTime: 'asc' },
    });

    return {
      success: true,
      message: 'Event reservation slots fetched successfully',
      data: slots,
    };
  }

  async updateEventSlot(
    eventId: string,
    slotId: string,
    dto: UpdateEventReservationSlotDto,
    actor: any,
  ) {
    const event = await this.getEventForMutation(eventId, actor);

    const existing = await this.prisma.eventReservationSlot.findFirst({
      where: { id: slotId, eventId },
    });
    if (!existing) {
      throw new NotFoundException('Event reservation slot not found');
    }

    const startDateTime = dto.startDateTime
      ? new Date(dto.startDateTime)
      : existing.startDateTime;
    const endDateTime = dto.endDateTime
      ? new Date(dto.endDateTime)
      : existing.endDateTime;
    this.assertValidDateRange(startDateTime, endDateTime);
    this.assertEventReservationSlotWithinEvent(event, startDateTime, endDateTime);

    const updated = await this.prisma.eventReservationSlot.update({
      where: { id: slotId },
      data: this.buildEventSlotUpdateData(dto),
    });

    return {
      success: true,
      message: 'Event reservation slot updated successfully',
      data: updated,
    };
  }

  private customerReservationInclude() {
    return {
      event: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      eventSlot: true,
      location: true,
      table: true,
      slot: true,
      payments: true,
    };
  }

  private adminReservationInclude() {
    return {
      event: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      eventSlot: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      location: true,
      table: true,
      slot: true,
      payments: true,
    };
  }

  private isPaystackPayment(method?: string | null) {
    return method === ReservationPaymentMethod.PAYSTACK;
  }

  private isWalletPayment(method?: string | null) {
    return !method || method === ReservationPaymentMethod.WALLET;
  }

  private assertReservationPayer(
    dto: { paymentMethod?: string; guestName?: string; guestEmail?: string; guestPhone?: string },
    actor: any,
  ) {
    if (this.isPaystackPayment(dto.paymentMethod)) {
      if (
        !actor?.id &&
        (!dto.guestName?.trim() || !dto.guestEmail?.trim() || !dto.guestPhone?.trim())
      ) {
        throw new BadRequestException(
          'Guest name, email, and phone are required for public reservations',
        );
      }
      return;
    }

    if (this.isWalletPayment(dto.paymentMethod)) {
      if (!actor?.id) {
        throw new UnauthorizedException('Authentication is required');
      }
      return;
    }

    throw new BadRequestException('Unsupported reservation payment method');
  }

  private generatePublicAccessToken() {
    return randomBytes(32).toString('hex');
  }

  private resolveReservationEmail(
    dto: { guestEmail?: string },
    actor: any,
  ) {
    return dto.guestEmail?.trim() || actor?.email?.trim() || null;
  }

  private async createAndPersistPaystackPaymentIntent(
    reservation: { id: string; depositAmount: Decimal | number | string },
    paymentIntentPayload: any,
  ) {
    let paymentIntent: any;
    try {
      paymentIntent = await this.payStackService.createPaymentIntent(
        paymentIntentPayload,
      );
    } catch (error) {
      await this.failPendingPaystackReservation(
        reservation.id,
        'Payment initialization failed',
        this.buildPaymentFailureMetadata(error),
      );
      throw error;
    }

    try {
      const referenceUpdate = await this.prisma.reservationPayment.updateMany({
        where: {
          reservationId: reservation.id,
          method: ReservationPaymentMethod.PAYSTACK,
          status: ReservationPaymentStatus.PENDING,
        },
        data: { reference: paymentIntent.reference },
      });

      if (referenceUpdate.count === 0) {
        throw new Error(RESERVATION_PAYMENT_INIT_FAILURE_MESSAGE);
      }
    } catch (error) {
      await this.failPendingPaystackReservation(
        reservation.id,
        'Payment initialization failed',
        this.buildReferencePersistenceFailureMetadata(error),
      );
      throw new BadRequestException(RESERVATION_PAYMENT_INIT_FAILURE_MESSAGE);
    }

    return paymentIntent;
  }

  private async failPendingPaystackReservation(
    reservationId: string,
    cancellationReason: string,
    metadata: Record<string, any>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.updateMany({
        where: {
          id: reservationId,
          status: ReservationStatus.PENDING_PAYMENT,
        },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason,
        },
      });

      await tx.reservationPayment.updateMany({
        where: {
          reservationId,
          method: ReservationPaymentMethod.PAYSTACK,
          status: ReservationPaymentStatus.PENDING,
        },
        data: {
          status: ReservationPaymentStatus.FAILED,
          metadata: metadata as any,
        },
      });
    });
  }

  private buildPaymentFailureMetadata(error: unknown) {
    if (error instanceof Error && error.message) {
      return { message: error.message };
    }

    return { message: 'Payment initialization failed' };
  }

  private buildReferencePersistenceFailureMetadata(error: unknown) {
    const cause =
      error instanceof Error &&
      error.message &&
      error.message !== RESERVATION_PAYMENT_INIT_FAILURE_MESSAGE
        ? error.message
        : undefined;

    return {
      message: RESERVATION_PAYMENT_INIT_FAILURE_MESSAGE,
      ...(cause && { cause }),
    };
  }

  private sanitizePaystackPaymentMetadata(
    data: any,
    extra: Record<string, any> = {},
  ) {
    const auditMetadata =
      data?.metadata && typeof data.metadata === 'object'
        ? this.pickDefined({
            purchasingType: data.metadata.purchasingType,
            reservationId: data.metadata.reservationId,
            reservationReference: data.metadata.reservationReference,
            source: data.metadata.source,
            eventId: data.metadata.eventId,
            eventSlotId: data.metadata.eventSlotId,
            locationId: data.metadata.locationId,
            slotId: data.metadata.slotId,
            tableId: data.metadata.tableId,
            tableCategory: data.metadata.tableCategory,
            guestCount: data.metadata.guestCount,
            startDateTime: data.metadata.startDateTime,
            endDateTime: data.metadata.endDateTime,
            userId: data.metadata.userId,
            guestName: data.metadata.guestName,
            guestEmail: data.metadata.guestEmail,
            guestPhone: data.metadata.guestPhone,
          })
        : undefined;

    return this.pickDefined({
      reference: data?.reference,
      status: data?.status,
      amount: data?.amount,
      currency: data?.currency,
      gateway_response: data?.gateway_response,
      paid_at: data?.paid_at,
      channel: data?.channel,
      fees: data?.fees,
      customerEmail: data?.customer?.email,
      customerCode: data?.customer?.customer_code,
      ...(auditMetadata &&
        Object.keys(auditMetadata).length > 0 && { metadata: auditMetadata }),
      ...extra,
    });
  }

  private pickDefined<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
    ) as Partial<T>;
  }

  private isExpiredPendingPaymentHold(reservation: any) {
    if (
      reservation?.status !== ReservationStatus.PENDING_PAYMENT ||
      !reservation?.createdAt
    ) {
      return false;
    }

    return (
      new Date(reservation.createdAt).getTime() <
      this.reservationPaymentHoldThreshold().getTime()
    );
  }

  private requiresNoLongerConfirmablePaystackManualReview(payment: any) {
    if (payment?.status === ReservationPaymentStatus.FAILED) {
      return true;
    }

    return this.isReservationNoLongerConfirmable(payment?.reservation);
  }

  private hasManualReviewRequiredMetadata(metadata: any) {
    return (
      !!metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      metadata.manualReviewRequired === true
    );
  }

  private isReservationNoLongerConfirmable(reservation: any) {
    if (!reservation?.status) {
      return false;
    }

    return ![
      ReservationStatus.PENDING_PAYMENT,
      ReservationStatus.CONFIRMED,
    ].includes(reservation.status);
  }

  private async recordExpiredPaystackHoldReservation(payment: any, data: any) {
    const metadata = this.sanitizePaystackPaymentMetadata(data, {
      manualReviewRequired: true,
      reason: PAYSTACK_EXPIRED_HOLD_MANUAL_REVIEW_REASON,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.reservationPayment.update({
        where: { id: payment.id },
        data: {
          status: ReservationPaymentStatus.SUCCESS,
          metadata: metadata as any,
        },
      });

      await tx.reservation.updateMany({
        where: {
          id: payment.reservationId,
          status: ReservationStatus.PENDING_PAYMENT,
        },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason: PAYSTACK_EXPIRED_HOLD_MANUAL_REVIEW_REASON,
        },
      });
    });

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: payment.reservationId },
      include: this.customerReservationInclude(),
    });

    return {
      success: false,
      message: PAYSTACK_EXPIRED_HOLD_MANUAL_REVIEW_REASON,
      data: this.maskPublicReservation(
        reservation ?? {
          ...payment.reservation,
          status: ReservationStatus.CANCELLED,
          cancellationReason: PAYSTACK_EXPIRED_HOLD_MANUAL_REVIEW_REASON,
        },
      ),
    };
  }

  private async recordNoLongerConfirmablePaystackReservation(
    payment: any,
    data: any,
  ) {
    const metadata = this.sanitizePaystackPaymentMetadata(data, {
      manualReviewRequired: true,
      reason: PAYSTACK_NO_LONGER_CONFIRMABLE_MANUAL_REVIEW_REASON,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.reservationPayment.updateMany({
        where: {
          reference: data.reference,
          method: ReservationPaymentMethod.PAYSTACK,
        },
        data: {
          status: ReservationPaymentStatus.SUCCESS,
          metadata: metadata as any,
        },
      });

      await tx.reservation.updateMany({
        where: {
          id: payment.reservationId,
          status: ReservationStatus.PENDING_PAYMENT,
        },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason: PAYSTACK_NO_LONGER_CONFIRMABLE_MANUAL_REVIEW_REASON,
        },
      });
    });

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: payment.reservationId },
      include: this.customerReservationInclude(),
    });

    return {
      success: false,
      message: PAYSTACK_MANUAL_REVIEW_MESSAGE,
      data: this.maskPublicReservation(
        reservation ?? {
          ...payment.reservation,
          status:
            payment.reservation?.status === ReservationStatus.PENDING_PAYMENT
              ? ReservationStatus.CANCELLED
              : payment.reservation?.status,
          cancellationReason:
            payment.reservation?.status === ReservationStatus.PENDING_PAYMENT
              ? PAYSTACK_NO_LONGER_CONFIRMABLE_MANUAL_REVIEW_REASON
              : payment.reservation?.cancellationReason,
        },
      ),
    };
  }

  private async recordPaystackManualReviewReservation(payment: any, data: any) {
    const metadata = this.sanitizePaystackPaymentMetadata(data, {
      manualReviewRequired: true,
      reason: PAYSTACK_MANUAL_REVIEW_REASON,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.reservationPayment.updateMany({
        where: {
          reference: data.reference,
          method: ReservationPaymentMethod.PAYSTACK,
        },
        data: {
          status: ReservationPaymentStatus.SUCCESS,
          metadata: metadata as any,
        },
      });

      await tx.reservation.updateMany({
        where: {
          id: payment.reservationId,
          status: ReservationStatus.PENDING_PAYMENT,
        },
        data: {
          status: ReservationStatus.CANCELLED,
          cancellationReason: PAYSTACK_MANUAL_REVIEW_REASON,
        },
      });
    });

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: payment.reservationId },
      include: this.customerReservationInclude(),
    });

    return {
      success: false,
      message: PAYSTACK_MANUAL_REVIEW_REASON,
      data: this.maskPublicReservation(
        reservation ?? {
          ...payment.reservation,
          status: ReservationStatus.CANCELLED,
          cancellationReason: PAYSTACK_MANUAL_REVIEW_REASON,
        },
      ),
    };
  }

  private reservationPaymentHoldThreshold(now = new Date()) {
    return new Date(
      now.getTime() - RESERVATION_PAYMENT_HOLD_MINUTES * 60 * 1000,
    );
  }

  private activeReservationWhere(now = new Date()): Prisma.ReservationWhereInput {
    const holdThreshold = this.reservationPaymentHoldThreshold(now);

    return {
      OR: [
        { status: { in: ACTIVE_RESERVATION_STATUSES } },
        {
          status: ReservationStatus.PENDING_PAYMENT,
          createdAt: { gte: holdThreshold },
        },
      ],
    };
  }

  private async cleanupExpiredPendingPaymentReservations(
    tx: Prisma.TransactionClient,
    input: {
      locationId: string;
      startDateTime: Date;
      endDateTime: Date;
    },
  ) {
    const expiredReservations = await tx.reservation.findMany({
      where: {
        locationId: input.locationId,
        status: ReservationStatus.PENDING_PAYMENT,
        createdAt: { lt: this.reservationPaymentHoldThreshold() },
        startDateTime: { lt: input.endDateTime },
        endDateTime: { gt: input.startDateTime },
      },
      select: { id: true },
    });
    const reservationIds = expiredReservations.map((reservation) => reservation.id);

    if (reservationIds.length === 0) {
      return;
    }

    await tx.reservation.updateMany({
      where: {
        id: { in: reservationIds },
        status: ReservationStatus.PENDING_PAYMENT,
      },
      data: {
        status: ReservationStatus.CANCELLED,
        cancellationReason: RESERVATION_PAYMENT_WINDOW_EXPIRED_REASON,
      },
    });

    await tx.reservationPayment.updateMany({
      where: {
        reservationId: { in: reservationIds },
        method: ReservationPaymentMethod.PAYSTACK,
        status: ReservationPaymentStatus.PENDING,
      },
      data: {
        status: ReservationPaymentStatus.FAILED,
        metadata: {
          reason: RESERVATION_PAYMENT_WINDOW_EXPIRED_REASON,
        } as any,
      },
    });
  }

  private async pickAvailableTable(
    tx: Prisma.TransactionClient,
    input: {
      locationId: string;
      tableCategory: string;
      guestCount: number;
      startDateTime: Date;
      endDateTime: Date;
    },
  ) {
    const tables = await tx.locationTable.findMany({
      where: {
        locationId: input.locationId,
        category: input.tableCategory,
        isActive: true,
        minGuests: { lte: input.guestCount },
        maxGuests: { gte: input.guestCount },
      },
      orderBy: { name: 'asc' },
    });
    const existingReservations = await tx.reservation.findMany({
      where: {
        locationId: input.locationId,
        ...this.activeReservationWhere(),
        startDateTime: { lt: input.endDateTime },
        endDateTime: { gt: input.startDateTime },
      },
      select: { tableId: true },
    });
    const reservedTableIds = new Set(
      existingReservations.map((reservation) => reservation.tableId),
    );
    const table = this.sortTablesByQuote(
      tables.filter((candidate) => !reservedTableIds.has(candidate.id)),
    )[0];

    if (!table) {
      throw new BadRequestException('This table category is no longer available');
    }

    return table;
  }

  private maskPublicReservation(reservation: any) {
    const { user: _user, payments, ...publicReservation } = reservation;
    return {
      ...publicReservation,
      guestEmail: this.maskEmail(publicReservation.guestEmail),
      guestPhone: this.maskPhone(publicReservation.guestPhone),
      ...(Array.isArray(payments) && {
        payments: payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          reference: payment.reference,
          createdAt: payment.createdAt,
        })),
      }),
    };
  }

  private maskEmail(email?: string | null) {
    if (!email) return email;
    const [localPart, domain] = email.split('@');
    if (!domain) return '***';
    if (localPart.length <= 2) {
      return `${localPart[0] ?? ''}***@${domain}`;
    }
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return phone;
    if (phone.length <= 6) return '***';
    const prefixLength = Math.min(5, phone.length - 3);
    return `${phone.slice(0, prefixLength)}*****${phone.slice(-3)}`;
  }

  private assertCanManageReservationRecord(reservation: any, actor: any) {
    if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(actor?.role)) {
      const vendorId = this.resolveVendorAccountId(actor, true);
      if (
        reservation.location?.vendorId !== vendorId &&
        reservation.event?.vendorId !== vendorId
      ) {
        throw new ForbiddenException(
          'Vendors can only update reservations for their own locations or events',
        );
      }
      return;
    }

    if (this.canManageReservations(actor)) {
      return;
    }

    throw new ForbiddenException('You do not have access to manage reservations');
  }

  private assertAdminReservationStatusAllowed(status: ReservationStatus) {
    if (!ADMIN_UPDATABLE_RESERVATION_STATUSES.includes(status)) {
      throw new BadRequestException('Reservation status cannot be set by this endpoint');
    }
  }

  private assertReservationStatusTransition(
    current: ReservationStatus,
    target: ReservationStatus,
  ) {
    if (current === target) {
      return;
    }

    const allowedTargets = RESERVATION_STATUS_TRANSITIONS[current] ?? [];
    if (!allowedTargets.includes(target)) {
      throw new BadRequestException(
        `Cannot transition reservation from ${current} to ${target}`,
      );
    }
  }

  private buildDateRange(date: string) {
    const [year, month, day] = this.dateOnly(date).split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
  }

  private startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async getEventForRead(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { location: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  private async getPublicEventForRead(eventId: string) {
    const event = await this.getEventForRead(eventId);
    if (
      event.isDeleted ||
      !PUBLIC_EVENT_RESERVATION_STATUSES.includes(event.status)
    ) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  private async getEventForMutation(eventId: string, actor: any) {
    const event = await this.getEventForRead(eventId);
    if (event.isDeleted) {
      throw new NotFoundException('Event not found');
    }

    if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(actor?.role)) {
      const vendorId = this.resolveVendorAccountId(actor, true);
      if (event.vendorId !== vendorId && event.location?.vendorId !== vendorId) {
        throw new ForbiddenException('You do not have access to this event');
      }
      return event;
    }

    if (this.canManageReservations(actor)) {
      return event;
    }

    throw new ForbiddenException('You do not have access to manage event reservations');
  }

  private async getLocationForRead(locationId: string, actor: any) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || location.status !== EntityStatus.ACTIVE) {
      throw new NotFoundException('Location not found');
    }

    if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(actor?.role)) {
      const vendorId = this.resolveVendorAccountId(actor, true);
      if (location.vendorId && location.vendorId !== vendorId) {
        throw new ForbiddenException('You do not have access to this location');
      }
      return location;
    }

    if (!this.canManageReservations(actor)) {
      throw new ForbiddenException('You do not have access to manage reservations');
    }

    return location;
  }

  private async getLocationForMutation(locationId: string, actor: any) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || location.status !== EntityStatus.ACTIVE) {
      throw new NotFoundException('Location not found');
    }

    if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(actor?.role)) {
      const vendorId = this.resolveVendorAccountId(actor, true);
      if (!location.vendorId || location.vendorId !== vendorId) {
        throw new ForbiddenException('Vendors can only update their own locations');
      }
      return location;
    }

    if (this.canManageReservations(actor)) {
      return location;
    }

    throw new ForbiddenException('You do not have access to manage reservations');
  }

  private resolveVendorAccountId(actor: any, required = false) {
    if (actor?.role === UserRole.VENDOR && actor.id) return actor.id;
    if (actor?.role === UserRole.VENDOR_STAFF && actor.vendorAccountId) {
      return actor.vendorAccountId;
    }
    if (required) throw new ForbiddenException('Vendor account scope is required');
    return null;
  }

  private canManageReservations(actor: any) {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.OPERATIONS_MANAGER,
    ].includes(actor?.role);
  }

  private assertValidGuestRange(minGuests: number, maxGuests: number) {
    if (maxGuests < minGuests) {
      throw new BadRequestException('maxGuests must be greater than or equal to minGuests');
    }
  }

  private assertValidDeposit(depositType: string, depositValue: number) {
    if (depositType === 'PERCENTAGE' && depositValue > 100) {
      throw new BadRequestException('Percentage depositValue cannot exceed 100');
    }
  }

  private assertDistinctSlotTimes(startTime: string, endTime: string) {
    if (startTime === endTime) {
      throw new BadRequestException('Reservation slot startTime and endTime cannot be equal');
    }
  }

  private assertValidDateRange(startDateTime: Date, endDateTime: Date) {
    if (
      Number.isNaN(startDateTime.getTime()) ||
      Number.isNaN(endDateTime.getTime()) ||
      endDateTime <= startDateTime
    ) {
      throw new BadRequestException('endDateTime must be after startDateTime');
    }
  }

  private assertEventReservationSlotWithinEvent(
    event: { startDate?: Date | null; endDate?: Date | null },
    startDateTime: Date,
    endDateTime: Date,
  ) {
    if (!event.startDate || !event.endDate) {
      throw new BadRequestException(
        'Event must have start and end dates for table reservations',
      );
    }

    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    if (
      Number.isNaN(eventStart.getTime()) ||
      Number.isNaN(eventEnd.getTime()) ||
      startDateTime < eventStart ||
      endDateTime > eventEnd
    ) {
      throw new BadRequestException(
        'Event reservation slot must be within the event date and time',
      );
    }
  }

  private normalizePage(value?: number) {
    const page = Number(value ?? 1);
    if (!Number.isFinite(page) || page < 1) return 1;
    return Math.min(Math.floor(page), 100);
  }

  private normalizeLimit(value?: number) {
    const limit = Number(value ?? 20);
    if (!Number.isFinite(limit) || limit < 1) return 20;
    return Math.min(Math.floor(limit), 100);
  }

  private assertSlotRunsOnDate(date: string, daysOfWeek: number[] = []) {
    if (!daysOfWeek.length) return;
    const [year, month, day] = this.dateOnly(date).split('-').map(Number);
    const selectedDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (!daysOfWeek.includes(selectedDay)) {
      throw new BadRequestException('Reservation slot is not available on selected date');
    }
  }

  private resolveSlotDateTimes(date: string, startTime: string, endTime: string, timezone?: string) {
    const startDateTime = this.buildDateTime(date, startTime, timezone);
    const endDateTime = this.buildDateTime(date, endTime, timezone);
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }
    return { startDateTime, endDateTime };
  }

  private buildDateTime(date: string, time: string, timezone = 'Africa/Nairobi') {
    const [year, month, day] = this.dateOnly(date).split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return this.zonedDateTimeToUtc(year, month, day, hour, minute, timezone);
  }

  private dateOnly(date: string) {
    return date.split('T')[0];
  }

  private groupAvailableTables(tables: any[], reservations: Array<{ tableId: string }>) {
    const reservedTableIds = new Set(reservations.map((reservation) => reservation.tableId));
    const categories = new Map<string, any>();

    for (const table of tables) {
      if (reservedTableIds.has(table.id)) continue;

      const quote = this.getTableQuote(table);
      const existing = categories.get(table.category);

      if (!existing) {
        categories.set(table.category, {
          category: table.category,
          availableCount: 1,
          minGuests: table.minGuests,
          maxGuests: table.maxGuests,
          minimumSpend: quote.minimumSpend,
          depositAmount: quote.depositAmount,
        });
        continue;
      }

      existing.availableCount += 1;
      existing.minGuests = Math.min(existing.minGuests, table.minGuests);
      existing.maxGuests = Math.max(existing.maxGuests, table.maxGuests);
      if (this.isBetterQuote(quote, existing)) {
        existing.minimumSpend = quote.minimumSpend;
        existing.depositAmount = quote.depositAmount;
      }
    }

    return Array.from(categories.values());
  }

  private sortTablesByQuote<T extends { minimumSpend: any; depositType: any; depositValue: any; name?: string }>(tables: T[]) {
    return [...tables].sort((a, b) => {
      const quoteA = this.getTableQuote(a);
      const quoteB = this.getTableQuote(b);
      if (quoteA.depositAmount !== quoteB.depositAmount) {
        return quoteA.depositAmount - quoteB.depositAmount;
      }
      if (quoteA.minimumSpend !== quoteB.minimumSpend) {
        return quoteA.minimumSpend - quoteB.minimumSpend;
      }
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
  }

  private getTableQuote(table: { minimumSpend: any; depositType: any; depositValue: any }) {
    const minimumSpend = Math.round(Number(table.minimumSpend));
    return {
      minimumSpend,
      depositAmount: this.calculateDeposit(
        minimumSpend,
        table.depositType,
        Number(table.depositValue),
      ),
    };
  }

  private isBetterQuote(
    quote: { minimumSpend: number; depositAmount: number },
    current: { minimumSpend: number; depositAmount: number },
  ) {
    if (quote.depositAmount !== current.depositAmount) {
      return quote.depositAmount < current.depositAmount;
    }
    return quote.minimumSpend < current.minimumSpend;
  }

  private calculateDeposit(
    minimumSpend: number,
    depositType: ReservationDepositType | string,
    depositValue: number,
  ) {
    if (depositType === ReservationDepositType.PERCENTAGE) {
      return Math.round((minimumSpend * depositValue) / 100);
    }
    return Math.round(depositValue);
  }

  private zonedDateTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string,
  ) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    const firstOffset = this.timezoneOffsetMillis(utcGuess, timezone);
    let zonedInstant = new Date(utcGuess.getTime() - firstOffset);
    const secondOffset = this.timezoneOffsetMillis(zonedInstant, timezone);
    if (secondOffset !== firstOffset) {
      zonedInstant = new Date(utcGuess.getTime() - secondOffset);
    }
    return zonedInstant;
  }

  private timezoneOffsetMillis(date: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return asUtc - date.getTime();
  }

  private generateReservationReference() {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RSV-${Date.now()}-${random}`;
  }

  private isReservationOverlapError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }
    const details = `${error.message} ${JSON.stringify(error.meta ?? {})}`.toLowerCase();
    if (details.includes('reservations_no_table_overlap_active')) {
      return true;
    }
    return (
      ['P2002', 'P2004', 'P2010'].includes(error.code) &&
      (details.includes('reservation') ||
        details.includes('overlap') ||
        details.includes('exclusion') ||
        details.includes('23p01'))
    );
  }

  private buildTableUpdateData(dto: UpdateLocationTableDto): Prisma.LocationTableUpdateInput {
    const data: Prisma.LocationTableUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.minGuests !== undefined) data.minGuests = dto.minGuests;
    if (dto.maxGuests !== undefined) data.maxGuests = dto.maxGuests;
    if (dto.minimumSpend !== undefined) {
      data.minimumSpend = new Decimal(dto.minimumSpend);
    }
    if (dto.depositType !== undefined) data.depositType = dto.depositType;
    if (dto.depositValue !== undefined) {
      data.depositValue = new Decimal(dto.depositValue);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }

  private buildSlotUpdateData(dto: UpdateReservationSlotDto): Prisma.ReservationSlotUpdateInput {
    const data: Prisma.ReservationSlotUpdateInput = {};

    if (dto.label !== undefined) data.label = dto.label;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.daysOfWeek !== undefined) data.daysOfWeek = dto.daysOfWeek;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }

  private buildEventSlotUpdateData(
    dto: UpdateEventReservationSlotDto,
  ): Prisma.EventReservationSlotUpdateInput {
    const data: Prisma.EventReservationSlotUpdateInput = {};

    if (dto.label !== undefined) data.label = dto.label;
    if (dto.startDateTime !== undefined) {
      data.startDateTime = new Date(dto.startDateTime);
    }
    if (dto.endDateTime !== undefined) {
      data.endDateTime = new Date(dto.endDateTime);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }
}
