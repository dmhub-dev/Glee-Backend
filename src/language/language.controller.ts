import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { CreateLanguageDto, UpdateLanguageDto } from './dto/language.dto';
import { LanguageService } from './language.service';
import { AllowAny } from '@src/config/auth-guard';

@ApiTags('Language')
@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  create(@Body() dto: CreateLanguageDto) {
    return this.languageService.create(dto);
  }

  @AllowAny()
  @Get()
  findAll() {
    return this.languageService.findAll();
  }

  @AllowAny()
  @Get('enabled')
  findAllEnabled() {
    return this.languageService.findAllEnabled();
  }

  @AllowAny()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.languageService.findOne(id);
  }

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLanguageDto) {
    return this.languageService.update(id, dto);
  }

  @Permissions(Permission.SETTINGS_MANAGE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.languageService.remove(id);
  }
}
