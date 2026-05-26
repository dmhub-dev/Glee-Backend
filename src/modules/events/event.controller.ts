import { AllowAny } from '@src/auth/jwt/jwt-auth.guard';
import { Permissions } from "@src/auth/rbac/permissions.decorator";
import { Permission } from "@src/auth/rbac/permissions.enum";
import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { EventService } from './event.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/common/responses/response';
import { EventParticipantFilterDto, RetrieveEventDto } from './dto/retrieve.event.dto';
import { NearByEvents } from './dto/nearby-events.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { loggers } from '@src/common/interceptors/logger.enums';

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

  @AllowAny()
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
    if (filter.eventId) query.eventId = filter.eventId;
    if (filter.userId) query.userId = filter.userId;
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
    if (filter.eventId) query.eventId = filter.eventId;
    if (filter.userId) query.userId = filter.userId;
    loggers.info('Event ID %O', filter);
    return this.eventService.eventParticipants(query, user);
  }

  @AllowAny()
  @ApiResponses(true)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser) {
    const userId = (currentUser && typeof currentUser === 'object' && currentUser.role === 'USER')
      ? currentUser.id
      : null;
    return this.eventService.findOne(id, userId);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get(':id')
  findOneEventByVendorId(@Param('id') id: string, @CurrentUser() currentUser) {
    return this.eventService.findOneEventByVendorId(id, currentUser);
  }
}
