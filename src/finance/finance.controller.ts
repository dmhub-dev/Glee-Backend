import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/shared/response';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { UserRole } from '@prisma/client';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@Controller('financials')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('revenue')
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

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('daily-earnings')
  dailyEarnings(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.dailyEarningsBySource({
      range: (range ?? earningsRange) as any,
    });
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('ticket-revenue')
  ticketRevenue(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.ticketRevenueOnly({ range: (range ?? earningsRange) as any });
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('avg-ticket-price')
  avgTicketPrice(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.averageTicketPrice({ range: (range ?? earningsRange) as any });
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('highest-selling-event')
  highestSellingEvent(@Query('range') range?: string, @Query('earningsRange') earningsRange?: string) {
    return this.financeService.highestSellingEvent({ range: (range ?? earningsRange) as any });
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('overview')
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

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('upcoming-events')
  upcomingEvents(@Query('limit') limit?: string) {
    return this.financeService.upcomingEvents({ limit: limit ? parseInt(limit, 10) : undefined });
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Permissions(Permission.REPORTS_READ)
  @Get('recent-sales')
  recentSales(@Query('limit') limit?: string) {
    return this.financeService.recentSales({ limit: limit ? parseInt(limit, 10) : undefined });
  }
}
