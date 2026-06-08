import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { ApiResponses } from '@src/common/responses/response';
import {
  ChatPaginationQueryDto,
  CreateEventChatMessageDto,
  DeleteEventChatMessageDto,
  MarkEventChatReadDto,
  UpdateEventChatMessageDto,
} from './dto/event-chat.dto';
import { EventChatGateway } from './event-chat.gateway';
import { EventChatService } from './event-chat.service';

@ApiTags('Event Chat')
@Controller('event/:eventId/chat')
export class EventChatController {
  constructor(
    private readonly eventChatService: EventChatService,
    private readonly eventChatGateway: EventChatGateway,
  ) {}

  @Get()
  @ApiResponses(true)
  getRoom(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.eventChatService.getRoom(eventId, user);
  }

  @Get('messages')
  @ApiResponses(true)
  listMessages(
    @Param('eventId') eventId: string,
    @Query() query: ChatPaginationQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.eventChatService.listMessages(eventId, query, user);
  }

  @Post('messages')
  @ApiResponses(true)
  async createMessage(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventChatMessageDto,
    @CurrentUser() user: any,
  ) {
    const message = await this.eventChatService.createMessage(eventId, dto, user);
    this.eventChatGateway.broadcastMessage(eventId, message);
    return message;
  }

  @Post('read')
  @ApiResponses(true)
  markRead(
    @Param('eventId') eventId: string,
    @Body() dto: MarkEventChatReadDto,
    @CurrentUser() user: any,
  ) {
    return this.eventChatService.markRead(eventId, dto, user);
  }

  @Patch('messages/:messageId')
  @ApiResponses(true)
  async updateMessagePin(
    @Param('eventId') eventId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateEventChatMessageDto,
    @CurrentUser() user: any,
  ) {
    const message = await this.eventChatService.updateMessagePin(eventId, messageId, dto, user);
    this.eventChatGateway.broadcastMessageUpdate(eventId, message);
    return message;
  }

  @Delete('messages/:messageId')
  @ApiResponses(true)
  async deleteMessage(
    @Param('eventId') eventId: string,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteEventChatMessageDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.eventChatService.deleteMessage(eventId, messageId, dto, user);
    this.eventChatGateway.broadcastMessageDelete(eventId, result.messageId);
    return result;
  }
}
