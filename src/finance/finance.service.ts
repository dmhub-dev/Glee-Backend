import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import Decimal from 'decimal.js';

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

  async revenueSeries(options?: {
    days?: number;
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
  }) {
    let startAndDays: { start: Date; days: number } | null = null;
    if (options?.range) startAndDays = this.getStartForRange(options.range);

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
      this.prisma.$queryRaw<
        {
          tickets_sold: number;
          ticket_revenue: number;
          total_revenue: number;
        }[]
      >`
        SELECT
          COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
          COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
          COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
        FROM "event_tickets" et
        JOIN "payments" p ON p."id" = et."paymentId"
        WHERE p."isPaid" = true
          AND p."createdAt" >= ${start}
      `,
    ]);

    const totalByDay = new Map(rows.map((r) => [r.day, Number((r as any).total ?? 0)]));

    const data = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const date = d.toISOString().slice(0, 10);
      const total = Number((totalByDay.get(date) ?? 0).toFixed(2));
      return {
        date,
        day: date,
        total,
        earnings: total,
        revenue: total,
        profit: total,
      };
    });

    const breakdownAgg = breakdownRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const menuRevenue = Math.max(0, breakdownAgg.total_revenue - breakdownAgg.ticket_revenue);
    const breakdown = {
      ticketsSold: breakdownAgg.tickets_sold,
      ticketRevenue: Number(new Decimal(breakdownAgg.ticket_revenue).toFixed(2)),
      menuRevenue: Number(new Decimal(menuRevenue).toFixed(2)),
      totalRevenue: Number(new Decimal(breakdownAgg.total_revenue).toFixed(2)),
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
    let startAndDays: { start: Date; days: number } | null = null;
    if (options?.range) startAndDays = this.getStartForRange(options.range);

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

    const rows = await this.prisma.$queryRaw<
      {
        day: string;
        tickets_sold: number;
        ticket_revenue: number;
        total_revenue: number;
      }[]
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
      const total = Number(new Decimal(agg.totalRevenue).toFixed(2));
      const ticketEarnings = Number(new Decimal(agg.ticketRevenue).toFixed(2));
      const menuEarnings = Number(new Decimal(menuRevenue).toFixed(2));

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

  async paymentsSummary() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [revenueAgg, revenueTodayAgg, revenueMonthAgg] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { isPaid: true },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, createdAt: { gte: startOfToday } },
        _sum: { totalPrice: true },
      }),
      this.prisma.payment.aggregate({
        where: { isPaid: true, createdAt: { gte: startOfMonth } },
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      count: revenueAgg._count._all,
      totalRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
      revenueToday: Number(revenueTodayAgg._sum.totalPrice ?? 0),
      revenueThisMonth: Number(revenueMonthAgg._sum.totalPrice ?? 0),
    };
  }

  async ticketAndMenuRevenueStats() {
    const ticketRows = await this.prisma.$queryRaw<
      {
        tickets_sold: number;
        ticket_revenue: number;
        total_revenue: number;
      }[]
    >`
      SELECT
        COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
        COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
        COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
      FROM "event_tickets" et
      JOIN "payments" p ON p."id" = et."paymentId"
      WHERE p."isPaid" = true
    `;

    const ticketAgg = ticketRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const menuRevenue = Math.max(0, ticketAgg.total_revenue - ticketAgg.ticket_revenue);
    const avgTicketPrice = ticketAgg.tickets_sold > 0 ? ticketAgg.ticket_revenue / ticketAgg.tickets_sold : 0;

    return {
      earning: Number(new Decimal(ticketAgg.total_revenue).toFixed(2)),
      ticketRevenue: Number(new Decimal(ticketAgg.ticket_revenue).toFixed(2)),
      menuRevenue: Number(new Decimal(menuRevenue).toFixed(2)),
      avgTicketPrice,
      ticketsSold: ticketAgg.tickets_sold,
    };
  }

  async ticketAndMenuRevenueStatsForRange(options?: { range?: 'today' | 'this_week' | 'this_month' | 'this_year' }) {
    const range = options?.range ?? 'this_week';
    const { start } = this.getStartForRange(range);

    const ticketRows = await this.prisma.$queryRaw<
      {
        tickets_sold: number;
        ticket_revenue: number;
        total_revenue: number;
      }[]
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

    const ticketAgg = ticketRows[0] ?? { tickets_sold: 0, ticket_revenue: 0, total_revenue: 0 };
    const menuRevenue = Math.max(0, ticketAgg.total_revenue - ticketAgg.ticket_revenue);
    const avgTicketPrice = ticketAgg.tickets_sold > 0 ? ticketAgg.ticket_revenue / ticketAgg.tickets_sold : 0;

    return {
      range,
      earning: Number(new Decimal(ticketAgg.total_revenue).toFixed(2)),
      ticketRevenue: Number(new Decimal(ticketAgg.ticket_revenue).toFixed(2)),
      menuRevenue: Number(new Decimal(menuRevenue).toFixed(2)),
      avgTicketPrice,
      ticketsSold: ticketAgg.tickets_sold,
    };
  }

  async eventTicketEarnings(eventId: string) {
    const rows = await this.prisma.$queryRaw<
      {
        tickets_sold: number;
        ticket_revenue: number;
        total_revenue: number;
      }[]
    >`
      SELECT
        COALESCE(SUM(p."noOfItems"), 0)::int AS tickets_sold,
        COALESCE(SUM(p."perItemPrice" * p."noOfItems"), 0)::float AS ticket_revenue,
        COALESCE(SUM(p."totalPrice"), 0)::float AS total_revenue
      FROM "event_tickets" et
      JOIN "payments" p ON p."id" = et."paymentId"
      WHERE et."eventId" = ${eventId}
        AND p."isPaid" = true
    `;

    const result = rows[0];
    if (!result || result.total_revenue <= 0) return [];

    const menuRevenue = Math.max(0, result.total_revenue - result.ticket_revenue);
    const avgTicketPrice = result.tickets_sold > 0 ? result.ticket_revenue / result.tickets_sold : 0;

    return [
      {
        _id: eventId,
        ticketsSold: result.tickets_sold,
        ticketRevenue: result.ticket_revenue,
        menuRevenue,
        grandTotal: result.total_revenue,
        avgTicketPrice,
        adminEarning: 0,
        vendorEarning: result.total_revenue,
      },
    ];
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
      .map((r) => ({
        name: r.category,
        value: Number((r as any).revenue ?? 0),
      }));

    return breakdown.length > 0 ? breakdown : [{ name: 'Other', value: 0 }];
  }

  async upcomingEvents(options?: { limit?: number }) {
    const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(50, options!.limit!)) : 6;
    const now = new Date();

    const data = await this.prisma.event.findMany({
      where: {
        isDeleted: false,
        suspended: false,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        locationName: true,
        city: true,
        country: true,
        bannerImages: true,
        price: true,
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
      include: {
        eventTicket: {
          include: {
            event: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
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

  async overview(options?: {
    range?: 'today' | 'this_week' | 'this_month' | 'this_year';
    upcomingLimit?: number;
    recentSalesLimit?: number;
  }) {
    const range = options?.range ?? 'this_week';

    const [payments, earnings, series, menuBreakdown, upcoming, recentSales] = await Promise.all([
      this.paymentsSummary(),
      this.ticketAndMenuRevenueStatsForRange({ range }),
      this.revenueSeries({ range }),
      this.menuBreakdown({ range }),
      this.upcomingEvents({ limit: options?.upcomingLimit }),
      this.recentSales({ limit: options?.recentSalesLimit }),
    ]);

    return {
      success: true,
      data: {
        range,
        payments,
        earnings,
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
      {
        event_id: string;
        tickets_sold: number;
        ticket_revenue: number;
        total_revenue: number;
      }[]
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
      select: { id: true, name: true, startDate: true, endDate: true, bannerImages: true },
    });

    const menuRevenue = Math.max(0, top.total_revenue - top.ticket_revenue);

    return {
      success: true,
      data: {
        range,
        event,
        ticketsSold: top.tickets_sold,
        ticketRevenue: Number(new Decimal(top.ticket_revenue).toFixed(2)),
        menuRevenue: Number(new Decimal(menuRevenue).toFixed(2)),
        totalRevenue: Number(new Decimal(top.total_revenue).toFixed(2)),
      },
    };
  }
}
