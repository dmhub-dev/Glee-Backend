import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { FinanceListQueryDto, FinanceRefundDto } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayments(query: FinanceListQueryDto) {
    const { where, page, limit } = this.paymentQuery(query);
    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: this.paymentInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where,
        _sum: { totalPrice: true },
        _count: { id: true },
      }),
    ]);

    return {
      success: true,
      message: 'Payments retrieved successfully',
      data: {
        items,
        total,
        page,
        limit,
        summary: {
          count: totals._count.id,
          totalAmount: Number(totals._sum.totalPrice ?? 0),
        },
      },
    };
  }

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.paymentInclude(),
    });
    if (!payment) throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { entity: 'Payment', entityId: id },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Payment retrieved successfully',
      data: { ...payment, auditLogs },
    };
  }

  async exportPayments(query: FinanceListQueryDto) {
    const { where } = this.paymentQuery(query);
    const payments = await this.prisma.payment.findMany({
      where,
      include: this.paymentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    const rows = [
      ['id', 'reference', 'status', 'method', 'amount', 'items', 'userEmail', 'eventName', 'createdAt'],
      ...payments.map(payment => [
        payment.id,
        payment.paystackReference,
        payment.paymentStatus,
        payment.paymentMethod,
        String(payment.totalPrice),
        String(payment.noOfItems),
        payment.eventTicket?.user?.email ?? '',
        payment.eventTicket?.event?.name ?? '',
        payment.createdAt.toISOString(),
      ]),
    ];

    return rows.map(row => row.map(value => this.csvValue(value)).join(',')).join('\n');
  }

  async recordRefund(id: string, dto: FinanceRefundDto, actor: any) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    if (!payment.isPaid) throw new HttpException('Only paid payments can be refunded', HttpStatus.BAD_REQUEST);

    const refundAmount = dto.amount ?? Number(payment.totalPrice);
    if (refundAmount <= 0 || refundAmount > Number(payment.totalPrice)) {
      throw new HttpException('Refund amount must be greater than 0 and not exceed payment amount', HttpStatus.BAD_REQUEST);
    }

    const status = dto.status ?? 'REFUND_PENDING';
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        paymentStatus: status,
        isAvailable: status !== 'REFUNDED',
      },
      include: this.paymentInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor?.id,
        action: 'payments.refund_record',
        entity: 'Payment',
        entityId: id,
        metadata: {
          amount: refundAmount,
          reason: dto.reason ?? null,
          status,
          previousStatus: payment.paymentStatus,
        },
      },
    });

    return {
      success: true,
      message: 'Refund recorded successfully',
      data: updated,
    };
  }

  async getSummary(query: FinanceListQueryDto) {
    const { where } = this.paymentQuery(query);
    const [payments, walletCredits, walletDebits, tickets] = await this.prisma.$transaction([
      this.prisma.payment.aggregate({
        where,
        _sum: { totalPrice: true },
        _count: { id: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: { type: 'CREDIT', ...this.walletDateWhere(query) },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: { type: 'DEBIT', ...this.walletDateWhere(query) },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.eventTicket.aggregate({
        where: { payment: where },
        _sum: { quantity: true, totalPrice: true },
        _count: { id: true },
      }),
    ]);

    return {
      success: true,
      message: 'Finance summary retrieved successfully',
      data: {
        payments: {
          count: payments._count.id,
          totalAmount: Number(payments._sum.totalPrice ?? 0),
        },
        tickets: {
          count: tickets._count.id,
          quantity: tickets._sum.quantity ?? 0,
          totalAmount: Number(tickets._sum.totalPrice ?? 0),
        },
        wallet: {
          creditsCount: walletCredits._count.id,
          creditsAmount: Number(walletCredits._sum.amount ?? 0),
          debitsCount: walletDebits._count.id,
          debitsAmount: Number(walletDebits._sum.amount ?? 0),
        },
      },
    };
  }

  async getEventRevenue(query: FinanceListQueryDto) {
    const { where } = this.paymentQuery(query);
    const tickets = await this.prisma.eventTicket.findMany({
      where: { payment: where },
      include: {
        event: { select: { id: true, name: true, vendorId: true } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const byEvent = new Map<string, any>();
    for (const ticket of tickets) {
      const eventId = ticket.eventId;
      const current = byEvent.get(eventId) ?? {
        eventId,
        eventName: ticket.event?.name ?? null,
        vendorId: ticket.event?.vendorId ?? null,
        tickets: 0,
        quantity: 0,
        grossRevenue: 0,
        paystackRevenue: 0,
        walletRevenue: 0,
      };
      const amount = Number(ticket.totalPrice);
      current.tickets += 1;
      current.quantity += ticket.quantity;
      current.grossRevenue += amount;
      if (ticket.payment?.paymentMethod === 'WALLET') current.walletRevenue += amount;
      else current.paystackRevenue += amount;
      byEvent.set(eventId, current);
    }

    return {
      success: true,
      message: 'Event revenue retrieved successfully',
      data: Array.from(byEvent.values()),
    };
  }

  async listWalletTransactions(query: FinanceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = this.walletDateWhere(query);
    if (query.userId) where.wallet = { userId: query.userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        include: { wallet: { include: { user: { select: { id: true, name: true, email: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      success: true,
      message: 'Wallet transactions retrieved successfully',
      data: { items, total, page, limit },
    };
  }

  private paymentQuery(query: FinanceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {};

    if (query.status) where.paymentStatus = query.status;
    if (query.method) where.paymentMethod = query.method;
    if (query.userId) where.userId = query.userId;
    if (query.eventId) where.eventTicket = { eventId: query.eventId };
    if (query.search) {
      where.OR = [
        { paystackReference: { contains: query.search, mode: 'insensitive' } },
        { eventTicket: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
        { eventTicket: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
        { eventTicket: { event: { name: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    return { where, page, limit };
  }

  private walletDateWhere(query: FinanceListQueryDto) {
    const where: any = {};
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    return where;
  }

  private paymentInclude() {
    return {
      eventTicket: {
        include: {
          event: { select: { id: true, name: true, vendorId: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
          ticketCategory: true,
        },
      },
    };
  }

  private csvValue(value: string) {
    const safe = value ?? '';
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }
}
