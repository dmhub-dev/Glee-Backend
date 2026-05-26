import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { EventTicketsService } from './event-tickets.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/common/responses/response';
import { UserRole } from '@prisma/client';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { IEventTicketAdminFilters } from './interfaces/filters';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';

@Controller('admin/event-ticket')
@ApiTags('Admin Event Tickets Routes')
export class AdminEventTicketsController {
  constructor(private readonly eventTicketsService: EventTicketsService) {}

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.BOOKINGS_READ)
  @Get()
  getAllEvents(@Query() queryData: PaginationQueryDto, @CurrentUser() user: any) {
    let filter: IEventTicketAdminFilters = {};
    if (queryData.eventId) filter.eventId = queryData.eventId;
    if (queryData.userId) filter.userId = queryData.userId;
    if (queryData._id) filter._id = queryData._id;
    return this.eventTicketsService.findAll(
      queryData.page,
      queryData.limit,
      filter,
      user,
    );
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateEventTicketDto: UpdateEventTicketDto) {
  //   return this.eventTicketsService.update(+id, updateEventTicketDto);
  // }
  @ApiResponses(true, [UserRole.VENDOR, UserRole.VENDOR_STAFF])
  @Permissions(Permission.BOOKINGS_UPDATE)
  @Patch(':id/check-in')
  checkIn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventTicketsService.checkInTicket(id, user);
  }

  @ApiResponses(true, [UserRole.VENDOR])
  @Permissions(Permission.BOOKINGS_UPDATE)
  @Patch(':id/check-in/revert')
  revertCheckIn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventTicketsService.revertTicketCheckIn(id, user);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.BOOKINGS_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.eventTicketsService.removeTicket(id);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.BOOKINGS_DELETE)
  @Delete('ticket')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTickets(
    @Query('eventId') eventId: string,
    @Query('userId') userId: string,
  ) {
    return this.eventTicketsService.remove(eventId, userId);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.BOOKINGS_DELETE)
  @Delete('ticket/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  permanentRemoveTickets() {
    return this.eventTicketsService.removePermanently();
  }
}
