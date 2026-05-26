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
