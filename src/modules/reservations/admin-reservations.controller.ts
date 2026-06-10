import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import {
  CreateEventReservationSlotDto,
  CreateLocationTableDto,
  CreateReservationSlotDto,
  ReservationListQueryDto,
  UpdateEventReservationSlotDto,
  UpdateLocationTableDto,
  UpdateReservationStatusDto,
  UpdateReservationSlotDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Admin Reservations')
@Controller('admin')
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true)
  @Get('reservations')
  listReservations(
    @Query() query: ReservationListQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.listAdminReservations(user, query);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true)
  @Patch('reservations/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.updateReservationStatus(id, dto, user);
  }

  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true)
  @Get('reservations/:id')
  getReservation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationsService.getAdminReservation(id, user);
  }

  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Get('events/:eventId/reservation-slots')
  listEventSlots(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.reservationsService.listAdminEventSlots(eventId, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Post('events/:eventId/reservation-slots')
  createEventSlot(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventReservationSlotDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.createEventSlot(eventId, dto, user);
  }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Patch('events/:eventId/reservation-slots/:slotId')
  updateEventSlot(
    @Param('eventId') eventId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateEventReservationSlotDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.updateEventSlot(eventId, slotId, dto, user);
  }

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
