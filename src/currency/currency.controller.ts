import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';
import { CurrencyService } from './currency.service';
import { AllowAny } from '@src/config/auth-guard';

@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @AllowAny()
  @Get()
  findAll() {
    return this.currencyService.findAll();
  }

  @AllowAny()
  @Get('enabled')
  findAllEnabled() {
    return this.currencyService.findAllEnabled();
  }

  @AllowAny()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currencyService.findOne(id);
  }

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencyService.update(id, dto);
  }

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.currencyService.remove(id);
  }
}
