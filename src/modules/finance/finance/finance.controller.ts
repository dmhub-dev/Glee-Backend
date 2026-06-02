import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { FinanceListQueryDto, FinanceRefundDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('payments')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.PAYMENTS_READ)
  listPayments(@Query() query: FinanceListQueryDto) {
    return this.financeService.listPayments(query);
  }

  @Get('payments/export')
  @Header('Content-Type', 'text/csv')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.PAYMENTS_EXPORT)
  exportPayments(@Query() query: FinanceListQueryDto) {
    return this.financeService.exportPayments(query);
  }

  @Get('payments/:id')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.PAYMENTS_READ)
  getPayment(@Param('id') id: string) {
    return this.financeService.getPayment(id);
  }

  @Post('payments/:id/refund')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.PAYMENTS_REFUND)
  recordRefund(
    @Param('id') id: string,
    @Body() dto: FinanceRefundDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.recordRefund(id, dto, user);
  }

  @Get('reports/summary')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  getSummary(@Query() query: FinanceListQueryDto) {
    return this.financeService.getSummary(query);
  }

  @Get('reports/overview')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  overview(
    @Query('range') range?: string,
    @Query('earningsRange') earningsRange?: string,
    @Query('upcomingLimit') upcomingLimit?: string,
    @Query('recentSalesLimit') recentSalesLimit?: string,
  ) {
    return this.financeService.overview({
      range: (range ?? earningsRange) as any,
      upcomingLimit: upcomingLimit ? parseInt(upcomingLimit, 10) : undefined,
      recentSalesLimit: recentSalesLimit ? parseInt(recentSalesLimit, 10) : undefined,
    });
  }

  @Get('reports/revenue')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  revenueSeries(
    @Query('days') days?: string,
    @Query('range') range?: string,
    @Query('earningsRange') earningsRange?: string,
  ) {
    return this.financeService.revenueSeries({
      days: days ? parseInt(days, 10) : undefined,
      range: (range ?? earningsRange) as any,
    });
  }

  @Get('reports/daily-earnings')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  dailyEarnings(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.dailyEarningsBySource({
      range: (range ?? earningsRange) as any,
    });
  }

  @Get('reports/ticket-revenue')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  ticketRevenue(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.ticketRevenueOnly({ range: (range ?? earningsRange) as any });
  }

  @Get('reports/avg-ticket-price')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  avgTicketPrice(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.averageTicketPrice({ range: (range ?? earningsRange) as any });
  }

  @Get('reports/highest-selling-event')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  highestSellingEvent(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.highestSellingEvent({ range: (range ?? earningsRange) as any });
  }

  @Get('reports/monthly-trend')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  monthlyTrend(@Query('months') months?: string) {
    return this.financeService.monthlyRevenueTrend({
      months: months ? parseInt(months, 10) : undefined,
    });
  }

  @Get('reports/upcoming-events')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  upcomingEvents(@Query('limit') limit?: string) {
    return this.financeService.upcomingEvents({ limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('reports/recent-sales')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  recentSales(@Query('limit') limit?: string) {
    return this.financeService.recentSales({ limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('reports/recent-payouts')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  recentPayouts(@Query('limit') limit?: string) {
    return this.financeService.recentPayouts({ limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('reports/events')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.REPORTS_READ)
  getEventRevenue(@Query() query: FinanceListQueryDto) {
    return this.financeService.getEventRevenue(query);
  }

  @Get('wallet-transactions')
  @ApiResponses(true, [UserRole.FINANCE])
  @Permissions(Permission.WALLET_READ)
  listWalletTransactions(@Query() query: FinanceListQueryDto) {
    return this.financeService.listWalletTransactions(query);
  }
}
