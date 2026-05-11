import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from 'src/schemas/enums/role';
import { ApiResponses } from 'src/shared/response';
import { BookingsService } from './bookings.service';
import { RetrieveBookingDto } from './dto/retrieve-bookings.dto';

@Controller('bookings')
@ApiTags('Bookings Public And User Routes')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiResponses(true, [Role.USER])
  @Get()
  findAll(@Query() query: RetrieveBookingDto) {
    let { limit, page } = query;
    return this.bookingsService.findAll(
      {
        ...query,
        isDeleted: false,
        search: null,
      },
      false,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id, { isDeleted: false });
  }

  @ApiResponses(true, [Role.USER])
  @Get('tables/:bookingId')
  getTables(@Param('bookingId') id: string) {
    return this.bookingsService.getTables(id);
  }
}
