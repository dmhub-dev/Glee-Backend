import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { FinanceListQueryDto, FinanceRefundDto } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getStartForRange(range: 'today' | 'this_week' | 'this_month' | 'this_year') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (range === 'today') return { start: now, days: 1 };
    if (range === 'this_week') return { start: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), days: 7 };
    if (range === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const days = Math.max(1, Math.round((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      return { start, days };
    }

    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.max(1, Math.round((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    return { start, days };
  }

  private toMoney(value: number) {
    return Number(new Decimal(value || 0).toFixed(2));
  }

  private toPctChange(current: number, previous: number) {
    const c = Number.isFinite(current) ? current : 0;
    const p = Number.isFinite(previous) ? previous : 0;
    if (p === 0) {
      const pct = c === 0 ? 0 : 100;
      return { current: c, previous: p, pct, direction: c === 0 ? 'flat' : 'up' as const };
    }
    const raw = ((c - p) / p) * 100;
    const pct = this.toMoney(raw);
    const direction = c > p ? 'up' : c < p ? 'down' : 'flat';
    return { current: c, previous: p, pct, direction };
  }

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

  async monthOverMonthKpis() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevMonthStart.setHours(0, 0, 0, 0);

    const dayOfMonth = now.getDate();
    let prevMonthEndExclusive = new Date(prevMonthStart);
    prevMonthEndExclusive.setDate(dayOfMonth + 1);
    prevMonthEndExclusive.setHours(0, 0, 0, 0);
    if (prevMonthEndExclusive > currentMonthStart) prevMonthEndExclusive = currentMonthStart;

    const [
      currentPaymentsAgg,
      prevPaymentsAgg,
      currentPayoutAgg,
      prevPayoutAgg,
      currentPendingAgg,
      prevPendingAgg,
      currentTicketRows,
      prevTicketRows,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { isPaid: true, createdAt: { gte: currentMonthStart, lt: startOfTomorrow } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, createdAt: { gte: prevMonthStart, lt: prevMonthEndExclusive } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, isAvailable: true, createdAt: { gte: currentMonthStart, lt: startOfTomorrow } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, isAvailable: true, createdAt: { gte: prevMonthStart, lt: prevMonthEndExclusive } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, isAvailable: false, createdAt: { gte: currentMonthStart, lt: startOfTomorrow } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, isAvailable: false, createdAt: { gte: prevMonthStart, lt: prevMonthEndExclusive } },
        _sum: { totalPrice: true },
      }),
      this.ticketPaymentAggregate(currentMonthStart, startOfTomorrow),
      this.ticketPaymentAggregate(prevMonthStart, prevMonthEndExclusive),
    ]);

    const currentTicketAgg = currentTicketRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const prevTicketAgg = prevTicketRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const currentTicketRevenue = Number(currentTicketAgg.ticket_revenue ?? 0);
    const prevTicketRevenue = Number(prevTicketAgg.ticket_revenue ?? 0);
    const currentMenuRevenue = Math.max(0, Number(currentTicketAgg.total_revenue ?? 0) - currentTicketRevenue);
    const prevMenuRevenue = Math.max(0, Number(prevTicketAgg.total_revenue ?? 0) - prevTicketRevenue);

    return {
      period: {
        current: { start: currentMonthStart, endExclusive: startOfTomorrow },
        previous: { start: prevMonthStart, endExclusive: prevMonthEndExclusive },
      },
      earning: this.toPctChange(Number(currentPaymentsAgg._sum.totalPrice ?? 0), Number(prevPaymentsAgg._sum.totalPrice ?? 0)),
      ticketRevenue: this.toPctChange(currentTicketRevenue, prevTicketRevenue),
      menuRevenue: this.toPctChange(currentMenuRevenue, prevMenuRevenue),
      totalPayouts: this.toPctChange(Number(currentPayoutAgg._sum.totalPrice ?? 0), Number(prevPayoutAgg._sum.totalPrice ?? 0)),
      payoutBalance: this.toPctChange(Number(currentPayoutAgg._sum.totalPrice ?? 0), Number(prevPayoutAgg._sum.totalPrice ?? 0)),
      pendingPayouts: this.toPctChange(Number(currentPendingAgg._sum.totalPrice ?? 0), Number(prevPendingAgg._sum.totalPrice ?? 0)),
    };
  }

  async revenueSeries(options?: {
    days?: number;
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
  }) {
    const { start, days } = this.resolveSeriesRange(options);

    const [rows, breakdownRows] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; total: number }[]>`
        SELECT
          to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          COALESCE(SUM("totalPrice"), 0)::float AS total
        FROM "payments"
        WHERE "isPaid" = true
          AND "createdAt" >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.ticketPaymentAggregate(start),
    ]);

    const totalByDay = new Map(rows.map((r) => [r.day, Number((r as any).total ?? 0)]));
    const data = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const date = d.toISOString().slice(0, 10);
      const total = this.toMoney(totalByDay.get(date) ?? 0);
      return { date, day: date, total, earnings: total, revenue: total, profit: total };
    });

    const breakdownAgg = breakdownRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const menuRevenue = Math.max(0, breakdownAgg.total_revenue - breakdownAgg.ticket_revenue);
    const breakdown = {
      ticketsSold: breakdownAgg.tickets_sold,
      ticketRevenue: this.toMoney(breakdownAgg.ticket_revenue),
      menuRevenue: this.toMoney(menuRevenue),
      totalRevenue: this.toMoney(breakdownAgg.total_revenue),
      avgTicketPrice: breakdownAgg.tickets_sold > 0 ? breakdownAgg.ticket_revenue / breakdownAgg.tickets_sold : 0,
    };

    return {
      success: true,
      data,
      breakdown,
      revenueBreakdown: [
        { name: 'Ticket revenue', value: breakdown.ticketRevenue },
        { name: 'Menu revenue', value: breakdown.menuRevenue },
      ],
      revenueBreakdownPie: [
        { name: 'Tickets sold', value: breakdown.ticketsSold },
        { name: 'Ticket revenue', value: breakdown.ticketRevenue },
        { name: 'Menu revenue', value: breakdown.menuRevenue },
      ],
    };
  }

  async dailyEarningsBySource(options?: {
    days?: number;
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
  }) {
    const { start, days } = this.resolveSeriesRange(options);

    const rows = await this.prisma.$queryRaw<
      { day: string; tickets_sold: number; ticket_revenue: number; total_revenue: number }[]
    >`
      SELECT
        to_char(date_trunc('day', p."createdAt"), 'YYYY-MM-DD') AS day,
        COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
        COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
        COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
      FROM "event_tickets" et
      JOIN "payments" p ON p."id" = et."paymentId"
      WHERE p."isPaid" = true
        AND p."createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const byDay = new Map(
      rows.map((r) => [
        r.day,
        {
          ticketsSold: Number((r as any).tickets_sold ?? 0),
          ticketRevenue: Number((r as any).ticket_revenue ?? 0),
          totalRevenue: Number((r as any).total_revenue ?? 0),
        },
      ]),
    );

    const data = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const date = d.toISOString().slice(0, 10);
      const agg = byDay.get(date) ?? { ticketsSold: 0, ticketRevenue: 0, totalRevenue: 0 };
      const menuRevenue = Math.max(0, agg.totalRevenue - agg.ticketRevenue);
      const total = this.toMoney(agg.totalRevenue);
      const ticketEarnings = this.toMoney(agg.ticketRevenue);
      const menuEarnings = this.toMoney(menuRevenue);

      return {
        date,
        day: date,
        total,
        earnings: total,
        revenue: total,
        profit: total,
        ticketsSold: agg.ticketsSold,
        ticketEarnings,
        menuEarnings,
        ticketRevenue: ticketEarnings,
        menuRevenue: menuEarnings,
      };
    });

    return { success: true, data };
  }

  async monthlyRevenueTrend(options?: { months?: number }) {
    const now = new Date();
    const months = Number.isFinite(options?.months) ? Math.max(1, Math.min(36, options!.months!)) : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    start.setHours(0, 0, 0, 0);

    const [paymentRows, ticketRows] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; earnings: number; payouts: number; pending_payouts: number }[]>`
        SELECT
          to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
          COALESCE(SUM("totalPrice"), 0)::float AS earnings,
          COALESCE(SUM(CASE WHEN "isAvailable" = true THEN "totalPrice" ELSE 0 END), 0)::float AS payouts,
          COALESCE(SUM(CASE WHEN "isAvailable" = false THEN "totalPrice" ELSE 0 END), 0)::float AS pending_payouts
        FROM "payments"
        WHERE "isPaid" = true
          AND "createdAt" >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      this.prisma.$queryRaw<{ month: string; tickets_sold: number; ticket_revenue: number; total_revenue: number }[]>`
        SELECT
          to_char(date_trunc('month', p."createdAt"), 'YYYY-MM') AS month,
          COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
          COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
          COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
        FROM "event_tickets" et
        JOIN "payments" p ON p."id" = et."paymentId"
        WHERE p."isPaid" = true
          AND p."createdAt" >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    const paymentByMonth = new Map(
      (paymentRows ?? []).map((r) => [
        r.month,
        {
          earnings: Number((r as any).earnings ?? 0),
          payouts: Number((r as any).payouts ?? 0),
          pendingPayouts: Number((r as any).pending_payouts ?? 0),
        },
      ]),
    );
    const ticketByMonth = new Map(
      (ticketRows ?? []).map((r) => [
        r.month,
        {
          ticketsSold: Number((r as any).tickets_sold ?? 0),
          ticketRevenue: Number((r as any).ticket_revenue ?? 0),
          totalRevenue: Number((r as any).total_revenue ?? 0),
        },
      ]),
    );

    const data = Array.from({ length: months }).map((_, idx) => {
      const d = new Date(start.getFullYear(), start.getMonth() + idx, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const p = paymentByMonth.get(monthKey) ?? { earnings: 0, payouts: 0, pendingPayouts: 0 };
      const t = ticketByMonth.get(monthKey) ?? { ticketsSold: 0, ticketRevenue: 0, totalRevenue: 0 };
      const menuRevenue = Math.max(0, t.totalRevenue - t.ticketRevenue);
      const balance = Math.max(0, p.earnings - p.payouts);

      return {
        month: monthKey,
        earnings: this.toMoney(p.earnings),
        payouts: this.toMoney(p.payouts),
        pendingPayouts: this.toMoney(p.pendingPayouts),
        balance: this.toMoney(balance),
        ticketsSold: t.ticketsSold,
        ticketRevenue: this.toMoney(t.ticketRevenue),
        menuRevenue: this.toMoney(menuRevenue),
      };
    });

    return { success: true, data };
  }

  async paymentsSummary() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenueAgg, revenueTodayAgg, revenueMonthAgg] = await Promise.all([
      this.prisma.payment.aggregate({ where: { isPaid: true }, _sum: { totalPrice: true }, _count: { id: true } }),
      this.prisma.payment.aggregate({ where: { isPaid: true, createdAt: { gte: startOfToday } }, _sum: { totalPrice: true } }),
      this.prisma.payment.aggregate({ where: { isPaid: true, createdAt: { gte: startOfMonth } }, _sum: { totalPrice: true } }),
    ]);

    return {
      count: revenueAgg._count.id,
      totalRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
      revenueToday: Number(revenueTodayAgg._sum.totalPrice ?? 0),
      revenueThisMonth: Number(revenueMonthAgg._sum.totalPrice ?? 0),
    };
  }

  async ticketAndMenuRevenueStatsForRange(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const { start } = this.getStartForRange(range);
    const ticketRows = await this.ticketPaymentAggregate(start);
    const ticketAgg = ticketRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const menuRevenue = Math.max(0, ticketAgg.total_revenue - ticketAgg.ticket_revenue);
    const avgTicketPrice = ticketAgg.tickets_sold > 0 ? ticketAgg.ticket_revenue / ticketAgg.tickets_sold : 0;

    return {
      range,
      earning: this.toMoney(ticketAgg.total_revenue),
      ticketRevenue: this.toMoney(ticketAgg.ticket_revenue),
      menuRevenue: this.toMoney(menuRevenue),
      avgTicketPrice,
      ticketsSold: ticketAgg.tickets_sold,
    };
  }

  async menuBreakdown(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const { start } = this.getStartForRange(range);

    const rows = await this.prisma.$queryRaw<{ category: string; revenue: number }[]>`
      SELECT
        COALESCE(emi."category", 'other') AS category,
        COALESCE(SUM(((item->>'price')::numeric) * ((item->>'quantity')::int)), 0)::float AS revenue
      FROM "event_tickets" et
      JOIN "payments" p
        ON p."id" = et."paymentId"
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(et."preOrderMenu", '[]'::jsonb)) AS item
      LEFT JOIN "event_menu_items" emi
        ON emi."id" = (item->>'id')
      WHERE p."isPaid" = true
        AND p."createdAt" >= ${start}
      GROUP BY 1
      ORDER BY revenue DESC
    `;

    const breakdown = (rows ?? [])
      .filter((r) => r && typeof r.category === 'string')
      .map((r) => ({ name: r.category, value: Number((r as any).revenue ?? 0) }));

    return breakdown.length > 0 ? breakdown : [{ name: 'Other', value: 0 }];
  }

  async upcomingEvents(options?: { limit?: number }) {
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(50, options!.limit!)) : 6;
    const now = new Date();

    const data = await this.prisma.event.findMany({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        photos: true,
        location: { select: { id: true, name: true, address: true } },
        ticketCategories: { select: { price: true }, orderBy: { price: 'asc' }, take: 1 },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return { success: true, data };
  }

  async recentSales(options?: { limit?: number }) {
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(500, options!.limit!)) : 200;
    const payments = await this.prisma.payment.findMany({
      where: { isPaid: true },
      include: this.paymentInclude(),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const data = payments.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      totalPrice: Number(p.totalPrice ?? 0),
      perItemPrice: Number(p.perItemPrice ?? 0),
      noOfItems: p.noOfItems ?? 0,
      paystackReference: p.paystackReference ?? null,
      paymentStatus: p.paymentStatus ?? null,
      paymentMethod: p.paymentMethod ?? null,
      event: p.eventTicket?.event ?? null,
      user: p.eventTicket?.user ?? null,
      eventTicketId: p.eventTicket?.id ?? null,
    }));

    return { success: true, data };
  }

  async recentPayouts(options?: { limit?: number }) {
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(500, options!.limit!)) : 50;
    const payments = await this.prisma.payment.findMany({
      where: { isPaid: true, isAvailable: true },
      include: this.paymentInclude(),
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const data = payments.map((p) => {
      const ticketRevenue = this.toMoney(Number(p.perItemPrice ?? 0) * (p.noOfItems ?? 0));
      const totalRevenue = this.toMoney(Number(p.totalPrice ?? 0));
      const menuRevenue = this.toMoney(Math.max(0, totalRevenue - ticketRevenue));
      return {
        id: p.id,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        payoutAmount: totalRevenue,
        ticketRevenue,
        menuRevenue,
        ticketsSold: p.noOfItems ?? 0,
        paystackReference: p.paystackReference ?? null,
        paymentStatus: p.paymentStatus ?? null,
        paymentMethod: p.paymentMethod ?? null,
        event: p.eventTicket?.event ?? null,
        user: p.eventTicket?.user ?? null,
        eventTicketId: p.eventTicket?.id ?? null,
      };
    });

    return { success: true, data };
  }

  async payoutStats(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const { start } = this.getStartForRange(range);

    const [totalAgg, availableAgg, pendingAgg, lastSale] = await Promise.all([
      this.prisma.payment.aggregate({ where: { isPaid: true, createdAt: { gte: start } }, _sum: { totalPrice: true }, _count: { id: true } }),
      this.prisma.payment.aggregate({ where: { isPaid: true, isAvailable: true, createdAt: { gte: start } }, _sum: { totalPrice: true }, _count: { id: true } }),
      this.prisma.payment.aggregate({ where: { isPaid: true, isAvailable: false, createdAt: { gte: start } }, _sum: { totalPrice: true }, _count: { id: true } }),
      this.prisma.payment.findFirst({ where: { isPaid: true }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, totalPrice: true } }),
    ]);

    const total = Number(totalAgg._sum.totalPrice ?? 0);
    const available = Number(availableAgg._sum.totalPrice ?? 0);
    const pending = Number(pendingAgg._sum.totalPrice ?? 0);

    return {
      range,
      totalPayouts: this.toMoney(available),
      payoutBalance: this.toMoney(available),
      pendingPayouts: this.toMoney(pending),
      totalRevenue: this.toMoney(total),
      availableCount: availableAgg._count.id,
      pendingCount: pendingAgg._count.id,
      totalCount: totalAgg._count.id,
      lastSaleAt: lastSale?.createdAt ?? null,
    };
  }

  async adminInsights(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const now = new Date();
    const { start } = this.getStartForRange(range);

    const [activeEvents, upcomingEvents, paidPaymentsInRange, unpaidPaymentsInRange] = await Promise.all([
      this.prisma.event.count({
        where: {
          isDeleted: false,
          status: 'ACTIVE',
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      this.prisma.event.count({
        where: { isDeleted: false, status: 'ACTIVE', startDate: { gte: now } },
      }),
      this.prisma.payment.count({ where: { isPaid: true, createdAt: { gte: start } } }),
      this.prisma.payment.count({ where: { isPaid: false, createdAt: { gte: start } } }),
    ]);

    return { range, activeEvents, upcomingEvents, paidPaymentsInRange, unpaidPaymentsInRange };
  }

  async overview(options?: {
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
    upcomingLimit?: number;
    recentSalesLimit?: number;
  }) {
    const range = options?.range ?? 'this_week';
    const [payments, earnings, series, menuBreakdown, upcoming, recentSales, payouts, admin, mom] = await Promise.all([
      this.paymentsSummary(),
      this.ticketAndMenuRevenueStatsForRange({ range }),
      this.revenueSeries({ range }),
      this.menuBreakdown({ range }),
      this.upcomingEvents({ limit: options?.upcomingLimit }),
      this.recentSales({ limit: options?.recentSalesLimit }),
      this.payoutStats({ range }),
      this.adminInsights({ range }),
      this.monthOverMonthKpis(),
    ]);

    return {
      success: true,
      data: {
        range,
        payments,
        earnings,
        payouts,
        mom,
        admin,
        dailyEarnings: series.data,
        menuBreakdown,
        menuItemsBreakdown: menuBreakdown,
        menuRevenueBreakdown: menuBreakdown,
        menuItemsRevenueBreakdown: menuBreakdown,
        upcomingEvents: upcoming.data,
        recentSales: recentSales.data,
      },
    };
  }

  async ticketRevenueOnly(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const stats = await this.ticketAndMenuRevenueStatsForRange({ range: options?.range });
    return { success: true, data: { range: stats.range, ticketRevenue: stats.ticketRevenue } };
  }

  async averageTicketPrice(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const stats = await this.ticketAndMenuRevenueStatsForRange({ range: options?.range });
    return { success: true, data: { range: stats.range, avgTicketPrice: stats.avgTicketPrice } };
  }

  async highestSellingEvent(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const { start } = this.getStartForRange(range);
    const rows = await this.prisma.$queryRaw<
      { event_id: string; tickets_sold: number; ticket_revenue: number; total_revenue: number }[]
    >`
      SELECT
        et."eventId" AS event_id,
        COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
        COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
        COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
      FROM "event_tickets" et
      JOIN "payments" p ON p."id" = et."paymentId"
      WHERE p."isPaid" = true
        AND p."createdAt" >= ${start}
      GROUP BY 1
      ORDER BY tickets_sold DESC, ticket_revenue DESC
      LIMIT 1
    `;
    const top = rows[0];
    if (!top) return { success: true, data: null };

    const event = await this.prisma.event.findUnique({
      where: { id: top.event_id },
      select: { id: true, name: true, startDate: true, endDate: true, photos: true },
    });
    const menuRevenue = Math.max(0, top.total_revenue - top.ticket_revenue);

    return {
      success: true,
      data: {
        range,
        event,
        ticketsSold: top.tickets_sold,
        ticketRevenue: this.toMoney(top.ticket_revenue),
        menuRevenue: this.toMoney(menuRevenue),
        totalRevenue: this.toMoney(top.total_revenue),
      },
    };
  }

  private resolveSeriesRange(options?: {
    days?: number;
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
  }) {
    const startAndDays = options?.range ? this.getStartForRange(options.range) : null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const days = startAndDays
      ? startAndDays.days
      : Number.isFinite(options?.days)
        ? Math.max(1, Math.min(366, options!.days!))
        : 30;
    const start = startAndDays
      ? startAndDays.start
      : (() => {
          const s = new Date(now);
          s.setDate(now.getDate() - (days - 1));
          return s;
        })();

    return { start, days };
  }

  private ticketPaymentAggregate(start: Date, endExclusive?: Date) {
    if (endExclusive) {
      return this.prisma.$queryRaw<
        { tickets_sold: number; ticket_revenue: number; total_revenue: number }[]
      >`
        SELECT
          COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
          COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
          COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
        FROM "event_tickets" et
        JOIN "payments" p ON p."id" = et."paymentId"
        WHERE p."isPaid" = true
          AND p."createdAt" >= ${start}
          AND p."createdAt" < ${endExclusive}
      `;
    }

    return this.prisma.$queryRaw<
      { tickets_sold: number; ticket_revenue: number; total_revenue: number }[]
    >`
      SELECT
        COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
        COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
        COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
      FROM "event_tickets" et
      JOIN "payments" p ON p."id" = et."paymentId"
      WHERE p."isPaid" = true
        AND p."createdAt" >= ${start}
    `;
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
