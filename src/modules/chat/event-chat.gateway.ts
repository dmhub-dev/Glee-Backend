import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({ namespace: '/event-chat', cors: { origin: '*' } })
export class EventChatGateway {}
