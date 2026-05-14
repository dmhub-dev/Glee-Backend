import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/jwt.strategy';
import { ApiResponses } from 'src/shared/response';
import { EventTicketsService } from './event-tickets.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Controller('event/tickets/')
@ApiTags('Public Event Tickets Route')
export class EventTicketsController {
  constructor(private readonly eventTicketsService: EventTicketsService) {}

  @ApiResponses(true, [UserRole.USER])
  @Post('purchase')
  purchaseEvent(
    @Body() createEventTicketDto: CreateEventTicketDto,
    @CurrentUser() currentUser,
  ) {
    return this.eventTicketsService.create(createEventTicketDto, currentUser);
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('my')
  findTicketByUserId(@CurrentUser() user, @Query() queryData: PaginationQueryDto) {
    return this.eventTicketsService.findTicketsByUserID(user.id, queryData);
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('available')
  getAvailableTicketsOfEvent(@Query() queryData: PaginationQueryDto) {
    return this.eventTicketsService.getAvailableTicktesOfEvent(queryData);
  }

  @ApiResponses(false)
  @Get(':id')
  getTicketsById(@Param('id') id: string) {
    return this.eventTicketsService.getTicketById(id);
  }
}
