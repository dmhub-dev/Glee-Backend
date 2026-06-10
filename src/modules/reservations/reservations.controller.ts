import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { ApiResponses } from '@src/common/responses/response';
import {
  CreateReservationDto,
  ReservationAvailabilityQueryDto,
  ReservationListQueryDto,
  VenueReservationQueryDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @ApiResponses(true)
  @Get('my')
  listMy(
    @Query() query: ReservationListQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.listMyReservations(user, query);
  }

  @ApiResponses(false)
  @Get('venues')
  listVenues(@Query() query: VenueReservationQueryDto) {
    return this.reservationsService.listReservationVenues(query);
  }

  @ApiResponses(false)
  @Get('venues/:locationId')
  getVenue(@Param('locationId') locationId: string) {
    return this.reservationsService.getReservationVenue(locationId);
  }

  @ApiResponses(false)
  @Get('venues/:locationId/availability')
  getAvailability(
    @Param('locationId') locationId: string,
    @Query() query: ReservationAvailabilityQueryDto,
  ) {
    return this.reservationsService.getVenueAvailability(locationId, query);
  }

  @ApiResponses(true)
  @Post()
  createReservation(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.createReservation(dto, user);
  }

  @ApiResponses(true)
  @Get(':id')
  getMy(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationsService.getMyReservation(id, user);
  }

  @ApiResponses(true)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.reservationsService.cancelMyReservation(id, dto, user);
  }
}
