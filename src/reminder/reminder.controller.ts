import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { CreateReminderDto, RetrieveRemindersDto, UpdateReminderDto } from './dto/reminder.dto';
import { ReminderService } from './reminder.service';

@ApiTags('Reminder')
@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Permissions(Permission.EVENTS_CREATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Post()
  create(@Body() dto: CreateReminderDto, @CurrentUser() user: any) {
    return this.reminderService.create(dto, user.id);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Get()
  findAll(@Query() query: RetrieveRemindersDto, @CurrentUser() user: any) {
    return this.reminderService.findAll(query, user.id);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reminderService.findOne(id);
  }

  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReminderDto) {
    return this.reminderService.update(id, dto);
  }

  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reminderService.remove(id);
  }
}
