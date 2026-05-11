import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { Role } from '../../schemas/enums/role';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { IEventTicketAdminFilters } from './interfaces/filters';

@Controller('admin/event-ticket')
@ApiTags('Admin Event Tickets Routes')
export class AdminEventTicketsController {
  constructor(private readonly eventTicketsService: EventTicketsService) {}

  @ApiResponses(true, [Role.ADMIN])
  @Get()
  getAllEvents(@Query() queryData: PaginationQueryDto) {
    let filter: IEventTicketAdminFilters = {};
    if (queryData.eventId) filter.eventId = queryData.eventId;
    if (queryData.userId) filter.userId = queryData.userId;
    if (queryData._id) filter._id = queryData._id;
    return this.eventTicketsService.findAll(
      queryData.page,
      queryData.limit,
      filter,
    );
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateEventTicketDto: UpdateEventTicketDto) {
  //   return this.eventTicketsService.update(+id, updateEventTicketDto);
  // }
  @ApiResponses(true, [Role.ADMIN])
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.eventTicketsService.removeTicket(id);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Delete('ticket')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTickets(
    @Query('eventId') eventId: string,
    @Query('userId') userId: string,
  ) {
    return this.eventTicketsService.remove(eventId, userId);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Delete('ticket/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  permanentRemoveTickets() {
    return this.eventTicketsService.removePermanently();
  }
}
