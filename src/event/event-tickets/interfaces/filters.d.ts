import { EventTickets } from '../../../schemas/event.tickets.schema';
import { User } from '../../../schemas/user.shema';
import { Events } from '../../../schemas/events.schema';

export interface IEventTicketAdminFilters {
  userId?: string | undefined;
  eventId?: string | undefined;
  _id?: string | undefined;
}
