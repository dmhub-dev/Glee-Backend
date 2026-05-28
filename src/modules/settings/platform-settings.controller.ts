import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { UpdateEventCheckoutSettingsDto } from './dto/event-checkout-settings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('Platform Settings')
@Controller('settings')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  @Get('event-checkout')
  @ApiResponses(false)
  getEventCheckoutSettings() {
    return this.settingsService.getPublicEventCheckoutSettings();
  }

  @Patch('event-checkout')
  @ApiResponses(true, [UserRole.SUPER_ADMIN, UserRole.ADMIN])
  @Permissions(Permission.SETTINGS_MANAGE)
  updateEventCheckoutSettings(@Body() dto: UpdateEventCheckoutSettingsDto) {
    return this.settingsService.updateEventCheckoutSettings(dto);
  }
}
