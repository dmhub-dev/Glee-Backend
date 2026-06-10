import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { ApiResponses } from '@src/common/responses/response';
import {
  CreateReservationDto,
  ReservationAvailabilityQueryDto,
  VenueReservationQueryDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

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
}
