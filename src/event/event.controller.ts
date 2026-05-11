import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { EventService } from './event.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '../shared/response';
import {
  EventParticipantFilterDto,
  RetrieveEventDto,
} from './dto/retrieve.event.dto';
import { Role } from '../schemas/enums/role';
import { NearByEvents } from './dto/nearby-events.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CurrentUser } from '../auth/jwt.strategy';
import { UserDocument } from '../schemas/user.shema';
import { FilterQuery } from 'mongoose';
import { EventTicketsDocument } from '../schemas/event.tickets.schema';
import { loggers } from '@src/interceptors/logger.enums';

@Controller('event')
@ApiTags('Public Event Routes')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  /**
   * Route: /event/nearby
   * @param location
   * @param radiusDto
   * @param searchDto
   * @param paginationDto
   */
  @ApiResponses(true, [Role.ADMIN, Role.USER])
  @Get('nearby')
  nearByEvents(
    @Query() filter: NearByEvents,
    @Query() paginationDto: PaginationQueryDto,
    @CurrentUser() currentUser,
  ) {
    let userId = null;
    if (currentUser.role === Role.USER) userId = currentUser;
    return this.eventService.nearByEvents(filter, userId, paginationDto);
  }

  /**
   * Route: /event
   * Method: GET
   * @param query
   */
  @ApiResponses(false)
  @Get()
  findAll(@Query() query: RetrieveEventDto) {
    return this.eventService.findAll(query);
  }

  /**
   * Route: /event vendor get event
   * Method: GET
   * @param query
   */

  @Version('2')
  @ApiResponses(true,[Role.VENDOR])
  @Get()
  findAllByVendorId(
  @CurrentUser() user,
  @Query() query: RetrieveEventDto) {
    return this.eventService.findAllByVendorId(query,user);
  }

  /**
   * Route: /event/participants
   * Method: GET
   */
  @ApiResponses(true, [Role.USER, Role.ADMIN])
  @Get('participants')
  eventParticipant(
    @Query() filter: EventParticipantFilterDto,
    @CurrentUser() user: UserDocument,
  ) {
    let query: FilterQuery<EventTicketsDocument> = {};
    if (user.role !== Role.ADMIN) query.userId = user._id;
    if (filter.eventId) query.eventId = filter.eventId;
    loggers.info('Event ID %O', filter);
    return this.eventService.eventParticipants(query, user);
  }

  @Version('2')
  @ApiResponses(true, [Role.VENDOR])
  @Get('participants')
  eventParticipantByVendor(
    @Query() filter: EventParticipantFilterDto,
    @CurrentUser() user: UserDocument,
  ) {
    let query: FilterQuery<EventTicketsDocument> = {};
    if (user.role !== Role.ADMIN) query.userId = user._id;
    if (filter.eventId) query.eventId = filter.eventId;
    loggers.info('Event ID %O', filter);
    return this.eventService.eventParticipants(query, user);
  }

  /**
   * Route: /event/:id
   * Method: GET
   * @param id
   */
  @ApiResponses(true, [Role.ADMIN, Role.USER])
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser) {
    let userId = null;
    if (currentUser.role === Role.USER) userId = currentUser;
    return this.eventService.findOne(id, userId);
  }

  /** vendor
   * Route: /event/:id
   * Method: GET
   * @param id
   */
  @Version('2')
  @ApiResponses(true, [Role.VENDOR])
  @Get(':id')
  findOneEventByVendorId(@Param('id') id: string, @CurrentUser() currentUser) {
    let userId = null;
    if (currentUser.role === Role.VENDOR) userId = currentUser;
    return this.eventService.findOneEventByVendorId(id, userId);
  }
}
