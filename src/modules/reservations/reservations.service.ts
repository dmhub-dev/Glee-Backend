import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityStatus, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import {
  CreateLocationTableDto,
  CreateReservationSlotDto,
  UpdateLocationTableDto,
  UpdateReservationSlotDto,
} from './dto/reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

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
