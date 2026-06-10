import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EntityStatus,
  Prisma,
  ReservationDepositType,
  ReservationPaymentMethod,
  ReservationPaymentStatus,
  ReservationSource,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import {
  CreateLocationTableDto,
  CreateReservationDto,
  CreateReservationSlotDto,
  ReservationAvailabilityQueryDto,
  UpdateLocationTableDto,
  UpdateReservationSlotDto,
  VenueReservationQueryDto,
} from './dto/reservation.dto';

const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.SEATED,
];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

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
        status: { in: ACTIVE_RESERVATION_STATUSES },
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

  async createReservation(dto: CreateReservationDto, actor: any) {
    if (!actor?.id) {
      throw new UnauthorizedException('Authentication is required');
    }
    if (dto.paymentMethod && dto.paymentMethod !== ReservationPaymentMethod.WALLET) {
      throw new BadRequestException('Only wallet payments are supported for reservations');
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
        const tables = await tx.locationTable.findMany({
          where: {
            locationId: dto.locationId,
            category: dto.tableCategory,
            isActive: true,
            minGuests: { lte: dto.guestCount },
            maxGuests: { gte: dto.guestCount },
          },
          orderBy: { name: 'asc' },
        });
        const existingReservations = await tx.reservation.findMany({
          where: {
            locationId: dto.locationId,
            status: { in: ACTIVE_RESERVATION_STATUSES },
            startDateTime: { lt: endDateTime },
            endDateTime: { gt: startDateTime },
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
    if (actor?.role === UserRole.VENDOR) return actor.id;
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
}
