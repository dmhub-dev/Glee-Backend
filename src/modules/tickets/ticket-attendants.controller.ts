import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { UserRole } from '@prisma/client';
import { TicketAttendantsService } from './ticket-attendants.service';
import {
  AttendantCheckInDto,
  CreateTicketAttendantDto,
  TicketAttendantAccessDto,
} from './dto/ticket-attendant.dto';

@Controller()
@ApiTags('Ticket Attendants')
export class TicketAttendantsController {
  constructor(private readonly ticketAttendantsService: TicketAttendantsService) {}

  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_READ)
  @Get('admin/events/:eventId/ticket-attendants')
  listAttendants(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.ticketAttendantsService.listAttendants(eventId, user);
  }

  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_READ)
  @Get('admin/events/:eventId/ticket-attendants/stats')
  getStats(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.ticketAttendantsService.getStats(eventId, user);
  }

  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_UPDATE)
  @Post('admin/events/:eventId/ticket-attendants')
  createAttendant(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTicketAttendantDto,
    @CurrentUser() user: any,
  ) {
    return this.ticketAttendantsService.createAttendant(eventId, dto, user);
  }

  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_UPDATE)
  @Patch('admin/events/:eventId/ticket-attendants/:id/reset-session')
  resetSession(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketAttendantsService.resetSession(eventId, id, user);
  }

  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_UPDATE)
  @Patch('admin/events/:eventId/ticket-attendants/:id/revoke')
  revokeAttendant(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketAttendantsService.revokeAttendant(eventId, id, user);
  }

  @ApiResponses(false)
  @Post('ticket-attendants/access')
  accessDesk(@Body() dto: TicketAttendantAccessDto, @Req() request: any) {
    return this.ticketAttendantsService.accessDesk(dto, request);
  }

  @ApiResponses(false)
  @Get('ticket-attendants/me')
  getDesk(@Headers('x-attendant-token') token: string) {
    return this.ticketAttendantsService.getDesk(token);
  }

  @ApiResponses(false)
  @Get('ticket-attendants/attendees')
  listAttendees(@Headers('x-attendant-token') token: string) {
    return this.ticketAttendantsService.listAttendees(token);
  }

  @ApiResponses(false)
  @Post('ticket-attendants/check-in')
  checkIn(
    @Headers('x-attendant-token') token: string,
    @Body() dto: AttendantCheckInDto,
  ) {
    return this.ticketAttendantsService.checkIn(token, dto);
  }

  @ApiResponses(false)
  @Post('ticket-attendants/logout')
  logout(@Headers('x-attendant-token') token: string) {
    return this.ticketAttendantsService.logout(token);
  }
}
