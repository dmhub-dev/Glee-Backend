import { AllowAny } from "@src/config/auth-guard";
import { Permissions } from "@src/auth/rbac/permissions.decorator";
import { Permission } from "@src/auth/rbac/permissions.enum";
import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { EventService } from './event.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '../shared/response';
import { EventParticipantFilterDto, RetrieveEventDto } from './dto/retrieve.event.dto';
import { NearByEvents } from './dto/nearby-events.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CurrentUser } from '../auth/jwt.strategy';
import { loggers } from '@src/interceptors/logger.enums';

@Controller('event')
@ApiTags('Public Event Routes')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @AllowAny()
  @ApiResponses(false)
  @Get('nearby')
  nearByEvents(
    @Query() filter: NearByEvents,
    @Query() paginationDto: PaginationQueryDto,
    @CurrentUser() currentUser,
  ) {
    const userId = currentUser?.role === 'USER' ? currentUser.id : null;
    return this.eventService.nearByEvents(filter, userId, paginationDto);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get()
  findAll(@Query() query: RetrieveEventDto) {
    return this.eventService.findAll(query);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get()
  findAllByVendorId(@CurrentUser() user, @Query() query: RetrieveEventDto) {
    return this.eventService.findAllByVendorId(query, user);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get('participants')
  eventParticipant(
    @Query() filter: EventParticipantFilterDto,
    @CurrentUser() user: any,
  ) {
    const query: any = {};
    if (user.role !== 'ADMIN') query.userId = user.id;
    if (filter.eventId) query.eventId = filter.eventId;
    loggers.info('Event ID %O', filter);
    return this.eventService.eventParticipants(query, user);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get('participants')
  eventParticipantByVendor(
    @Query() filter: EventParticipantFilterDto,
    @CurrentUser() user: any,
  ) {
    const query: any = {};
    if (user.role !== 'ADMIN') query.userId = user.id;
    if (filter.eventId) query.eventId = filter.eventId;
    loggers.info('Event ID %O', filter);
    return this.eventService.eventParticipants(query, user);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser) {
    const userId = currentUser?.role === 'USER' ? currentUser.id : null;
    return this.eventService.findOne(id, userId);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get(':id')
  findOneEventByVendorId(@Param('id') id: string, @CurrentUser() currentUser) {
    const userId = currentUser?.role === 'VENDOR' ? currentUser.id : null;
    return this.eventService.findOneEventByVendorId(id, userId);
  }
}
