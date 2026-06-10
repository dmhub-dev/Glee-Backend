import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import {
  CreateLocationTableDto,
  CreateReservationSlotDto,
  UpdateLocationTableDto,
  UpdateReservationSlotDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Admin Reservations')
@Controller('admin')
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Get('locations/:locationId/tables')
  listTables(@Param('locationId') locationId: string, @CurrentUser() user: any) {
    return this.reservationsService.listTables(locationId, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Post('locations/:locationId/tables')
  createTable(
    @Param('locationId') locationId: string,
    @Body() dto: CreateLocationTableDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.createTable(locationId, dto, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Patch('locations/:locationId/tables/:tableId')
  updateTable(
    @Param('locationId') locationId: string,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateLocationTableDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.updateTable(locationId, tableId, dto, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Get('locations/:locationId/reservation-slots')
  listSlots(@Param('locationId') locationId: string, @CurrentUser() user: any) {
    return this.reservationsService.listSlots(locationId, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Post('locations/:locationId/reservation-slots')
  createSlot(
    @Param('locationId') locationId: string,
    @Body() dto: CreateReservationSlotDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.createSlot(locationId, dto, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Patch('locations/:locationId/reservation-slots/:slotId')
  updateSlot(
    @Param('locationId') locationId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateReservationSlotDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.updateSlot(locationId, slotId, dto, user);
  }
}
