import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
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
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { ApiResponses } from '@src/shared/response';
import { UserRole } from '@prisma/client';
import { SocketGateway } from '@src/socket/socket.gateway';
import { loggers } from '@src/interceptors/logger.enums';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Permissions(Permission.CHAT_CREATE)
  @ApiResponses(true, [UserRole.USER])
  @Post()
  create(@Body() createChatDto: CreateChatDto, @CurrentUser() user: any) {
    return this.chatService.create(createChatDto, user);
  }

  @Permissions(Permission.CHAT_READ)
  @ApiResponses(true, [UserRole.USER])
  @Get()
  async findAll(
    @CurrentUser('id') from,
    @Query('to') to: string,
    @CurrentUser() user: any,
  ) {
    const resData = await this.chatService.findAll(from, to);
    loggers.info('O index........', resData?.data[0]);
    SocketGateway.emitEvent('init', { data: resData?.data, from, to }, to);
    return resData;
  }

  @Get('block/:userId')
  blockUser(@Param('userId') id: string, @CurrentUser() me: any) {
    try {
      me.blockedUsersList = [...(me.blockedUsersList || []), id];
      return {
        success: true,
        message: 'User blocked successfully',
      };
    } catch (e) {
      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }

  @Permissions(Permission.CHAT_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  @Permissions(Permission.CHAT_READ)
  @Patch(':id')
  readMessage(@Param('id') id: string) {
    return this.chatService.update(id);
  }
}
