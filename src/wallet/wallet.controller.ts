import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { GetWalletOtpDto, TopUpWalletDto, WalletOtpDto, WalletVerifyOtpDto } from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Permissions(Permission.WALLET_READ)
  @ApiResponses(true, [UserRole.USER])
  @Get()
  getWallet(@CurrentUser() user: any) {
    return this.walletService.getWallet(user.id);
  }

  @Permissions(Permission.WALLET_TOPUP)
  @ApiResponses(true, [UserRole.USER])
  @Post('top-up')
  topUp(@Body() dto: TopUpWalletDto, @CurrentUser() user: any) {
    return this.walletService.topUp(user.id, dto, user.email);
  }

  @Permissions(Permission.WALLET_READ)
  @ApiResponses(true, [UserRole.USER])
  @Post('otp/create')
  setOtp(@Body() body: WalletOtpDto, @CurrentUser() user: any) {
    return this.walletService.setWalletOtp(body.otp, user.id);
  }

  @Permissions(Permission.WALLET_READ)
  @ApiResponses(true, [UserRole.USER])
  @Post('otp/get')
  getOtp(@Body() body: GetWalletOtpDto, @CurrentUser() user: any) {
    return this.walletService.getWalletOtp(body.password, user.id);
  }

  @Permissions(Permission.WALLET_READ)
  @ApiResponses(true, [UserRole.USER])
  @Post('otp/verify')
  verifyOtp(@Body() body: WalletVerifyOtpDto, @CurrentUser() user: any) {
    return this.walletService.verifyWalletOtp(body.otp, user.id);
  }
}
