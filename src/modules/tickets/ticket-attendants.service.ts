import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  EventStatus,
  TicketAttendantStatus,
  TicketCheckInAttemptResult,
  TicketCheckInAttemptSource,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { EmailService } from '@src/infrastructure/email/email.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import {
  AttendantCheckInDto,
  CreateTicketAttendantDto,
  TicketAttendantAccessDto,
} from './dto/ticket-attendant.dto';

@Injectable()
export class TicketAttendantsService {
  private readonly logger = new Logger(TicketAttendantsService.name);
  private readonly accessWindowMinutes = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async createAttendant(eventId: string, dto: CreateTicketAttendantDto, actor: any) {
    const event = await this.findManageableEvent(eventId, actor);
    this.assertCanManageAttendants(actor, event);

    const pin = this.generatePin();
    const token = randomBytes(32).toString('hex');
    const attendant = await this.prisma.eventTicketAttendant.create({
      data: {
        eventId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        pinHash: await bcrypt.hash(pin, 10),
        inviteTokenHash: this.hashSecret(token),
        createdById: actor?.id ?? null,
      },
      include: {
        event: {
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        },
      },
    });

    const inviteUrl = this.buildInviteUrl(token);
    await this.safeSendInviteEmail(attendant.email, {
      attendantName: attendant.name,
      eventName: event.name,
      eventStartDate: event.startDate,
      eventEndDate: event.endDate,
      inviteUrl,
    });

    await this.audit(actor, 'ticket_attendants.invite', attendant.id, {
      eventId,
      email: attendant.email,
    });

    return {
      success: true,
      message: 'Ticket attendant invited successfully',
      data: this.toAdminAttendant(attendant, { pin, inviteUrl }),
    };
  }

  async listAttendants(eventId: string, actor: any) {
    const event = await this.findManageableEvent(eventId, actor);
    this.assertCanManageAttendants(actor, event);

    const attendants = await this.prisma.eventTicketAttendant.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            checkedTickets: true,
            checkInAttempts: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Ticket attendants retrieved successfully',
      data: attendants.map((attendant) => this.toAdminAttendant(attendant)),
    };
  }

  async getStats(eventId: string, actor: any) {
    const event = await this.findManageableEvent(eventId, actor);
    this.assertCanManageAttendants(actor, event);

    const attendants = await this.prisma.eventTicketAttendant.findMany({
      where: { eventId },
      select: { id: true, name: true, email: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    const attempts = await this.prisma.ticketCheckInAttempt.groupBy({
      by: ['attendantId', 'result'],
      where: { eventId },
      _count: { _all: true },
    });

    const statsByAttendant = new Map<string, any>();
    attendants.forEach((attendant) => {
      statsByAttendant.set(attendant.id, {
        ...attendant,
        email: this.maskEmail(attendant.email),
        success: 0,
        duplicate: 0,
        invalid: 0,
        attempts: 0,
      });
    });

    attempts.forEach((attempt) => {
      if (!attempt.attendantId || !statsByAttendant.has(attempt.attendantId)) return;
      const row = statsByAttendant.get(attempt.attendantId);
      const count = attempt._count._all;
      row.attempts += count;
      if (attempt.result === TicketCheckInAttemptResult.SUCCESS) row.success += count;
      else if (attempt.result === TicketCheckInAttemptResult.DUPLICATE) row.duplicate += count;
      else row.invalid += count;
    });

    return {
      success: true,
      message: 'Ticket attendant stats retrieved successfully',
      data: Array.from(statsByAttendant.values()),
    };
  }

  async resetSession(eventId: string, attendantId: string, actor: any) {
    const event = await this.findManageableEvent(eventId, actor);
    this.assertCanManageAttendants(actor, event);
    const attendant = await this.findAttendantOrThrow(eventId, attendantId);

    await this.prisma.$transaction([
      this.prisma.eventTicketAttendant.update({
        where: { id: attendant.id },
        data: { sessionActive: false, lastSessionId: null },
      }),
      this.prisma.eventTicketAttendantSession.updateMany({
        where: { attendantId: attendant.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit(actor, 'ticket_attendants.session_reset', attendant.id, { eventId });

    return {
      success: true,
      message: 'Ticket attendant session reset successfully',
      data: { id: attendant.id },
    };
  }

  async revokeAttendant(eventId: string, attendantId: string, actor: any) {
    const event = await this.findManageableEvent(eventId, actor);
    this.assertCanManageAttendants(actor, event);
    const attendant = await this.findAttendantOrThrow(eventId, attendantId);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.eventTicketAttendant.update({
        where: { id: attendant.id },
        data: {
          status: TicketAttendantStatus.REVOKED,
          sessionActive: false,
          lastSessionId: null,
          revokedAt: now,
        },
      }),
      this.prisma.eventTicketAttendantSession.updateMany({
        where: { attendantId: attendant.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await this.audit(actor, 'ticket_attendants.revoke', attendant.id, { eventId });

    return {
      success: true,
      message: 'Ticket attendant access revoked successfully',
      data: { id: attendant.id },
    };
  }

  async accessDesk(dto: TicketAttendantAccessDto, request: any) {
    const attendant = await this.prisma.eventTicketAttendant.findUnique({
      where: { inviteTokenHash: this.hashSecret(dto.token) },
      include: { event: true },
    });
    if (!attendant) {
      throw new HttpException('Invalid ticket attendant access link', HttpStatus.UNAUTHORIZED);
    }
    if (attendant.status === TicketAttendantStatus.REVOKED) {
      throw new HttpException('Ticket attendant access has been revoked', HttpStatus.FORBIDDEN);
    }
    if (attendant.status === TicketAttendantStatus.EXPIRED || attendant.event.status === EventStatus.ENDED) {
      throw new HttpException('Ticket attendant access has expired', HttpStatus.FORBIDDEN);
    }
    if (attendant.email.toLowerCase() !== dto.email.trim().toLowerCase()) {
      throw new HttpException('Ticket attendant details do not match this invite', HttpStatus.UNAUTHORIZED);
    }
    if (attendant.name.trim().toLowerCase() !== dto.name.trim().toLowerCase()) {
      throw new HttpException('Ticket attendant details do not match this invite', HttpStatus.UNAUTHORIZED);
    }
    if (!(await bcrypt.compare(dto.pin, attendant.pinHash))) {
      throw new HttpException('Invalid ticket attendant PIN', HttpStatus.UNAUTHORIZED);
    }
    this.assertAccessWindowOpen(attendant.event);
    const hasActiveSession = await this.hasActiveSession(attendant.id);
    if (hasActiveSession) {
      throw new HttpException(
        'This attendant already has an active session. Ask the event admin to reset access.',
        HttpStatus.CONFLICT,
      );
    }

    const sessionToken = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = this.resolveSessionExpiry(attendant.event);
    const activated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.eventTicketAttendant.updateMany({
        where: {
          id: attendant.id,
          sessionActive: false,
          status: { in: [TicketAttendantStatus.INVITED, TicketAttendantStatus.ACTIVE] },
        },
        data: {
          status: TicketAttendantStatus.ACTIVE,
          sessionActive: true,
          lastLoginAt: now,
        },
      });
      if (claimed.count !== 1) return null;

      const session = await tx.eventTicketAttendantSession.create({
        data: {
          attendantId: attendant.id,
          eventId: attendant.eventId,
          sessionTokenHash: this.hashSecret(sessionToken),
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
          expiresAt,
          lastSeenAt: now,
        },
      });

      const updated = await tx.eventTicketAttendant.update({
        where: { id: attendant.id },
        data: { lastSessionId: session.id },
        include: { event: true },
      });

      return { session, updated };
    });
    if (!activated) {
      throw new HttpException(
        'This attendant already has an active session. Ask the event admin to reset access.',
        HttpStatus.CONFLICT,
      );
    }

    return {
      success: true,
      message: 'Ticket attendant access granted',
      data: {
        token: sessionToken,
        expiresAt,
        attendant: this.toDeskAttendant(activated.updated),
        event: this.toDeskEvent(activated.updated.event),
      },
    };
  }

  async getDesk(sessionToken: string) {
    const session = await this.resolveSession(sessionToken, false);
    return {
      success: true,
      message: 'Ticket attendant desk retrieved successfully',
      data: {
        attendant: this.toDeskAttendant(session.attendant),
        event: this.toDeskEvent(session.event),
        canCheckIn: session.event.status === EventStatus.LIVE,
      },
    };
  }

  async listAttendees(sessionToken: string) {
    const session = await this.resolveSession(sessionToken, false);
    const tickets = await this.prisma.eventTicket.findMany({
      where: { eventId: session.eventId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        ticketRef: true,
        ticketNumber: true,
        status: true,
        checkedInAt: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        preOrderMenu: true,
        user: { select: { name: true, email: true, phone: true } },
        ticketCategory: { select: { name: true } },
        checkedInByAttendant: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      message: 'Event attendees retrieved successfully',
      data: tickets.map((ticket) => this.toDeskTicket(ticket, { includeTicketRef: false })),
    };
  }

  async checkIn(sessionToken: string, dto: AttendantCheckInDto) {
    const session = await this.resolveSession(sessionToken, true);
    const ticketRef = String(dto.ticketRef ?? '').trim();
    const source =
      dto.source === 'MANUAL'
        ? TicketCheckInAttemptSource.MANUAL
        : TicketCheckInAttemptSource.QR;

    if (session.event.status !== EventStatus.LIVE) {
      await this.recordAttempt({
        eventId: session.eventId,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.NOT_LIVE,
        source,
        metadata: { ticketRef },
      });
      throw new HttpException('This event is not live yet', HttpStatus.BAD_REQUEST);
    }

    const ticket = await this.prisma.eventTicket.findFirst({
      where: { ticketRef },
      include: {
        event: true,
        user: { select: { name: true, email: true, phone: true } },
        ticketCategory: { select: { name: true } },
        checkedInByAttendant: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      await this.recordAttempt({
        eventId: session.eventId,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.UNKNOWN,
        source,
        metadata: { ticketRef },
      });
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }
    if (ticket.eventId !== session.eventId) {
      await this.recordAttempt({
        eventId: session.eventId,
        ticketId: ticket.id,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.WRONG_EVENT,
        source,
        metadata: { ticketRef, ticketEventId: ticket.eventId },
      });
      throw new HttpException('This ticket is not valid for this event', HttpStatus.BAD_REQUEST);
    }
    if (this.resolveTicketStatus(ticket) === TicketStatus.EXPIRED) {
      await this.recordAttempt({
        eventId: session.eventId,
        ticketId: ticket.id,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.EXPIRED,
        source,
        metadata: { ticketRef },
      });
      throw new HttpException('This ticket has expired', HttpStatus.BAD_REQUEST);
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      await this.recordAttempt({
        eventId: session.eventId,
        ticketId: ticket.id,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.CANCELLED,
        source,
        metadata: { ticketRef },
      });
      throw new HttpException('This ticket has been cancelled', HttpStatus.BAD_REQUEST);
    }
    if (ticket.status === TicketStatus.USED || ticket.checkedInAt) {
      await this.recordAttempt({
        eventId: session.eventId,
        ticketId: ticket.id,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.DUPLICATE,
        source,
        metadata: { ticketRef, checkedInAt: ticket.checkedInAt },
      });
      throw new HttpException(
        {
          message: 'This ticket has already been checked in',
          checkedInAt: ticket.checkedInAt,
          checkedInBy: ticket.checkedInByAttendant,
        },
        HttpStatus.CONFLICT,
      );
    }

    const checkedInAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.eventTicket.updateMany({
        where: {
          id: ticket.id,
          status: TicketStatus.ACTIVE,
          checkedInAt: null,
        },
        data: {
          status: TicketStatus.USED,
          checkedInAt,
          checkedInByAttendantId: session.attendantId,
        },
      });
      if (updatedCount.count !== 1) return null;

      const updatedTicket = await tx.eventTicket.findUnique({
        where: { id: ticket.id },
        select: {
          id: true,
          ticketRef: true,
          ticketNumber: true,
          status: true,
          checkedInAt: true,
          guestName: true,
          guestEmail: true,
          guestPhone: true,
          preOrderMenu: true,
          user: { select: { name: true, email: true, phone: true } },
          ticketCategory: { select: { name: true } },
          checkedInByAttendant: { select: { id: true, name: true } },
        },
      });
      await tx.ticketCheckInAttempt.create({
        data: {
          eventId: session.eventId,
          ticketId: ticket.id,
          attendantId: session.attendantId,
          result: TicketCheckInAttemptResult.SUCCESS,
          source,
          metadata: { ticketRef },
        },
      });
      return updatedTicket;
    });
    if (!updated) {
      await this.recordAttempt({
        eventId: session.eventId,
        ticketId: ticket.id,
        attendantId: session.attendantId,
        result: TicketCheckInAttemptResult.DUPLICATE,
        source,
        metadata: { ticketRef, reason: 'conditional_update_failed' },
      });
      throw new HttpException(
        {
          message: 'This ticket has already been checked in',
        },
        HttpStatus.CONFLICT,
      );
    }

    return {
      success: true,
      message: 'Ticket checked in successfully',
      data: this.toDeskTicket(updated, { includeTicketRef: true }),
    };
  }

  async logout(sessionToken: string) {
    const session = await this.resolveSession(sessionToken, false);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.eventTicketAttendantSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      }),
      this.prisma.eventTicketAttendant.update({
        where: { id: session.attendantId },
        data: { sessionActive: false, lastSessionId: null },
      }),
    ]);

    return {
      success: true,
      message: 'Ticket attendant logged out successfully',
      data: null,
    };
  }

  private async findManageableEvent(eventId: string, actor: any) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      select: { id: true, name: true, vendorId: true, status: true, startDate: true, endDate: true },
    });
    if (!event) throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    if (actor?.role === UserRole.VENDOR && event.vendorId !== actor.id) {
      throw new HttpException('You do not have access to this event', HttpStatus.FORBIDDEN);
    }
    return event;
  }

  private assertCanManageAttendants(actor: any, event: any) {
    if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(actor?.role)) return;
    if (actor?.role === UserRole.VENDOR && event.vendorId === actor.id) return;
    throw new HttpException('Only admin or vendor users can manage ticket attendants', HttpStatus.FORBIDDEN);
  }

  private async findAttendantOrThrow(eventId: string, attendantId: string) {
    const attendant = await this.prisma.eventTicketAttendant.findFirst({
      where: { id: attendantId, eventId },
    });
    if (!attendant) throw new HttpException('Ticket attendant not found', HttpStatus.NOT_FOUND);
    return attendant;
  }

  private async resolveSession(sessionToken: string, touch: boolean) {
    if (!sessionToken) {
      throw new HttpException('Ticket attendant session token is required', HttpStatus.UNAUTHORIZED);
    }
    const session = await this.prisma.eventTicketAttendantSession.findUnique({
      where: { sessionTokenHash: this.hashSecret(sessionToken) },
      include: {
        event: true,
        attendant: true,
      },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new HttpException('Ticket attendant session has expired', HttpStatus.UNAUTHORIZED);
    }
    if (
      session.attendant.status === TicketAttendantStatus.REVOKED ||
      session.attendant.status === TicketAttendantStatus.EXPIRED ||
      !session.attendant.sessionActive ||
      session.attendant.lastSessionId !== session.id
    ) {
      throw new HttpException('Ticket attendant session is no longer active', HttpStatus.UNAUTHORIZED);
    }
    if (session.event.status === EventStatus.ENDED) {
      throw new HttpException('Ticket attendant access has expired', HttpStatus.FORBIDDEN);
    }
    if (touch) {
      await this.prisma.eventTicketAttendantSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }
    return session;
  }

  private assertAccessWindowOpen(event: any) {
    const now = new Date();
    if (event.status === EventStatus.LIVE) return;
    if (event.status !== EventStatus.ACTIVE) {
      throw new HttpException('Ticket attendant access is not open for this event', HttpStatus.FORBIDDEN);
    }
    if (!event.startDate) {
      throw new HttpException('This event does not have a start time yet', HttpStatus.BAD_REQUEST);
    }
    const opensAt = new Date(event.startDate.getTime() - this.accessWindowMinutes * 60_000);
    if (now < opensAt) {
      throw new HttpException('Ticket attendant access opens closer to event start time', HttpStatus.FORBIDDEN);
    }
  }

  private async hasActiveSession(attendantId: string) {
    const now = new Date();
    const activeSession = await this.prisma.eventTicketAttendantSession.findFirst({
      where: { attendantId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!activeSession) return false;
    if (activeSession.expiresAt > now) return true;
    await this.prisma.$transaction([
      this.prisma.eventTicketAttendantSession.update({
        where: { id: activeSession.id },
        data: { revokedAt: now },
      }),
      this.prisma.eventTicketAttendant.update({
        where: { id: attendantId },
        data: { sessionActive: false, lastSessionId: null },
      }),
    ]);
    return false;
  }

  private async recordAttempt(input: {
    eventId: string;
    ticketId?: string;
    attendantId: string;
    result: TicketCheckInAttemptResult;
    source: TicketCheckInAttemptSource;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.ticketCheckInAttempt.create({
      data: {
        eventId: input.eventId,
        ticketId: input.ticketId,
        attendantId: input.attendantId,
        result: input.result,
        source: input.source,
        metadata: (input.metadata ?? {}) as any,
      },
    });
  }

  private resolveTicketStatus(ticket: any): TicketStatus {
    if (ticket.status === TicketStatus.USED || ticket.checkedInAt) return TicketStatus.USED;
    if (ticket.status === TicketStatus.CANCELLED) return TicketStatus.CANCELLED;
    const eventEnd = ticket.event?.endDate ?? ticket.event?.startDate;
    if (eventEnd && new Date(eventEnd).getTime() < Date.now()) return TicketStatus.EXPIRED;
    return TicketStatus.ACTIVE;
  }

  private resolveSessionExpiry(event: any) {
    const basis = event.endDate ?? event.startDate;
    if (!basis) return new Date(Date.now() + 12 * 60 * 60_000);
    return new Date(new Date(basis).getTime() + 2 * 60 * 60_000);
  }

  private generatePin() {
    return String(randomInt(100000, 1000000));
  }

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private buildInviteUrl(token: string) {
    const baseUrl =
      this.config.get<string>('ATTENDANT_APP_URL') ??
      this.config.get<string>('CLIENT_APP_URL') ??
      'http://localhost:3001';
    return `${baseUrl.replace(/\/$/, '')}/ticket-attendant/access?token=${token}`;
  }

  private async safeSendInviteEmail(
    email: string,
    locals: Record<string, unknown>,
  ) {
    try {
      await this.emailService.sendMail({
        template: 'emails/event/ticket-attendant-invite',
        sender: 'tickets',
        message: {
          to: email,
          subject: 'Ticket attendant access for your event',
        },
        locals,
      });
    } catch (error) {
      this.logger.warn(`Ticket attendant invite email failed: ${(error as Error).message}`);
    }
  }

  private async audit(actor: any, action: string, entityId: string, metadata: any) {
    if (!actor?.id) return;
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action,
        entity: 'EventTicketAttendant',
        entityId,
        metadata,
      },
    });
  }

  private toAdminAttendant(attendant: any, extra: any = {}) {
    return {
      id: attendant.id,
      eventId: attendant.eventId,
      name: attendant.name,
      email: attendant.email,
      status: attendant.status,
      sessionActive: attendant.sessionActive,
      lastLoginAt: attendant.lastLoginAt,
      revokedAt: attendant.revokedAt,
      createdAt: attendant.createdAt,
      checkedInCount: attendant._count?.checkedTickets,
      attemptCount: attendant._count?.checkInAttempts,
      ...extra,
    };
  }

  private toDeskAttendant(attendant: any) {
    return {
      id: attendant.id,
      name: attendant.name,
      email: this.maskEmail(attendant.email),
      status: attendant.status,
    };
  }

  private toDeskEvent(event: any) {
    return {
      id: event.id,
      name: event.name,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
    };
  }

  private toDeskTicket(ticket: any, options: { includeTicketRef?: boolean } = {}) {
    const name = ticket.guestName ?? ticket.user?.name ?? 'Guest';
    const email = ticket.guestEmail ?? ticket.user?.email ?? null;
    const phone = ticket.guestPhone ?? ticket.user?.phone ?? null;
    return {
      id: ticket.id,
      ...(options.includeTicketRef ? { ticketRef: ticket.ticketRef } : {}),
      ticketRefDisplay: this.maskTicketRef(ticket.ticketRef),
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      attendee: {
        name,
        email: this.maskEmail(email),
        phone: this.maskPhone(phone),
      },
      ticketTier: ticket.ticketCategory?.name ?? null,
      menu: ticket.preOrderMenu ?? null,
      checkedInBy: ticket.checkedInByAttendant ?? null,
    };
  }

  private maskEmail(email?: string | null) {
    if (!email) return null;
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}***@${domain}`;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return null;
    const trimmed = String(phone);
    if (trimmed.length <= 4) return '****';
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
  }

  private maskTicketRef(ticketRef?: string | null) {
    if (!ticketRef) return null;
    const value = String(ticketRef);
    if (value.length <= 8) return '****';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}
