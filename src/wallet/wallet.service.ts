import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/prisma/prisma.service';
import { CurrencyService } from '@src/currency/currency.service';
import { CURRENCY_CODES } from '@src/currency/currency.constant';
import { PayStackService } from '@src/paystack/paystack.service';
import { PurchasingType, TopUpWalletMetadata } from '@src/paystack/paystack.types';
import { TopUpWalletDto } from './dto/wallet.dto';
var CryptoJS = require('crypto-js');

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
    private readonly payStackService: PayStackService,
    private readonly config: ConfigService,
  ) {
    // Register this service as the wallet handler for Paystack webhooks
    this.payStackService.walletHandler = this;
  }

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId, points: 0, refPrice: 0 } });
    }
    return wallet;
  }

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        paymentHistory: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) return { success: true, data: { points: 0, paymentHistory: [] } };
    return { success: true, data: wallet };
  }

  async topUp(userId: string, dto: TopUpWalletDto, email: string) {
    let usdToKesRate = 129.0;
    const currencyKenya = await this.currencyService.findByCode(CURRENCY_CODES.KES);
    if (currencyKenya) usdToKesRate = currencyKenya.exchangeRate;

    const totalPrice = dto.amount * usdToKesRate;

    const metaData: TopUpWalletMetadata = {
      userId,
      amount: dto.amount,
      points: dto.amount,
      purchasingType: PurchasingType.TOP_UP_WALLET,
    };

    return this.payStackService.createPaymentIntent({
      email,
      amount: Math.round(totalPrice),
      metaData,
    });
  }

  async createTopUpWalletPayment(data: any, paystackReference: string) {
    const metadata = data.metadata as TopUpWalletMetadata;

    const existing = await this.prisma.payment.findUnique({ where: { paystackReference } });
    if (existing) return;

    const payment = await this.prisma.payment.create({
      data: {
        userId: metadata.userId,
        paystackReference,
        bankAccountNumber: data.authorization?.last4,
        paymentStatus: 'SUCCEEDED',
        paymentMethod: 'PAYSTACK',
        totalPrice: new Decimal(metadata.amount),
        perItemPrice: new Decimal(metadata.amount),
        isPaid: true,
        isAvailable: true,
      },
    });

    await this.addPointsToWallet(metadata.userId, metadata.points, payment.id);
  }

  async addPointsToWallet(userId: string, points: number, paymentId?: string) {
    const wallet = await this.getOrCreateWallet(userId);

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { points: { increment: points } },
    });

    await this.prisma.walletPaymentHistory.create({
      data: {
        walletId: wallet.id,
        paymentId,
        points,
        type: 'CREDIT',
      },
    });

    return wallet;
  }

  async deductFromWallet(userId: string, points: number, paymentId?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.points < points) {
      throw new HttpException('Insufficient wallet balance', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { points: { decrement: points } },
    });

    await this.prisma.walletPaymentHistory.create({
      data: {
        walletId: wallet.id,
        paymentId,
        points,
        type: 'DEBIT',
      },
    });

    return wallet;
  }

  async getPointsValue(points: number, toCurrency: string = 'USD') {
    if (toCurrency === 'USD') return points;
    const currency = await this.currencyService.findByCode(toCurrency);
    if (!currency) return points;
    return points * currency.exchangeRate;
  }

  async setWalletOtp(otp: number, userId: string) {
    const ciphertext = CryptoJS.AES.encrypt(`${otp}`, this.config.get('SECRETKEY')).toString();
    await this.prisma.user.update({ where: { id: userId }, data: { walletOtpToken: ciphertext } });
    return { success: true };
  }

  async getWalletOtp(password: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const areEqual = await bcrypt.compare(password, user.password);
    if (!areEqual) throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    if (!user.walletOtpToken) throw new HttpException('No wallet PIN set', HttpStatus.BAD_REQUEST);
    const bytes = CryptoJS.AES.decrypt(user.walletOtpToken, this.config.get('SECRETKEY'));
    return { success: true, data: bytes.toString(CryptoJS.enc.Utf8) };
  }

  async verifyWalletOtp(otp: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.walletOtpToken) throw new HttpException('No wallet PIN set', HttpStatus.BAD_REQUEST);

    const bytes = CryptoJS.AES.decrypt(user.walletOtpToken, this.config.get('SECRETKEY'));
    const original = bytes.toString(CryptoJS.enc.Utf8);

    if (original !== otp) throw new HttpException('Invalid PIN', HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
