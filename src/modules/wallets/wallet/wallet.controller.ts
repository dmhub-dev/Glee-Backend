import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { WalletTopUpDto, WalletTransactionsQueryDto } from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiResponses(true, [UserRole.USER])
  @Permissions(Permission.WALLET_READ)
  getWallet(@CurrentUser() user: any) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  @ApiResponses(true, [UserRole.USER])
  @Permissions(Permission.WALLET_READ)
  getTransactions(@CurrentUser() user: any, @Query() query: WalletTransactionsQueryDto) {
    return this.walletService.getTransactions(user.id, query.page, query.limit);
  }

  @Post('top-up')
  @ApiResponses(true, [UserRole.USER])
  @Permissions(Permission.WALLET_TOPUP)
  topUp(@CurrentUser() user: any, @Body() dto: WalletTopUpDto) {
    return this.walletService.initiateTopUp(user, dto);
  }
}
