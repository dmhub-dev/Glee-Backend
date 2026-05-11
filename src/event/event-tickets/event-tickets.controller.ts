import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Role } from '../../schemas/enums/role';
import { CurrentUser } from '../../auth/jwt.strategy';

@Controller('event/tickets/')
@ApiTags('Public Event Tickets Route')
export class EventTicketsController {
  constructor(private readonly eventTicketsService: EventTicketsService) {}

  @ApiResponses(true, [Role.USER])
  @Post('purchase')
  purchaseEvent(
    @Body() createEventTicketDto: CreateEventTicketDto,
    @CurrentUser() currentUser,
  ) {
    const [expMonth, expYear] = createEventTicketDto.exp.split('/');
    if (currentUser.role === Role.USER)
      createEventTicketDto.userId = currentUser._id;
    return this.eventTicketsService.create(
      createEventTicketDto,
      expMonth,
      expYear,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get('my')
  findTicketByUserId(
    @CurrentUser() user,
    @Query() queryData: PaginationQueryDto,
  ) {
    return this.eventTicketsService.findTicketsByUserID(user._id, queryData);
  }

  @ApiResponses(true, [Role.USER])
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
