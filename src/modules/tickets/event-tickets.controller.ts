import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { ApiResponses } from '@src/common/responses/response';
import { AllowAny } from '@src/auth/jwt/jwt-auth.guard';
import { EventTicketsService } from './event-tickets.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { CreateGuestTicketDto } from './dto/create-guest-ticket.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
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

  @AllowAny()
  @Post('initiate-guest')
  initiateGuestPurchase(@Body() dto: CreateGuestTicketDto) {
    return this.eventTicketsService.initiateGuestPurchase(dto);
  }

  @AllowAny()
  @Post('confirm-purchase')
  confirmPurchase(@Body() dto: ConfirmPurchaseDto) {
    return this.eventTicketsService.confirmPurchase(dto);
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
