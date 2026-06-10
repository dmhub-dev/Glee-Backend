import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { PurchasingType } from '@src/infrastructure/payments/paystack/paystack.types';
import { WalletTopUpDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payStackService: PayStackService,
  ) {
    this.payStackService.walletHandler = this;
  }

  async getOrCreateWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (wallet) return wallet;
    return this.prisma.wallet.create({ data: { userId } });
  }

  async getWallet(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const recentTransactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      message: 'Wallet retrieved successfully',
      data: { ...wallet, recentTransactions },
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getOrCreateWallet(userId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      success: true,
      message: 'Wallet transactions retrieved successfully',
      data: { items, total, page, limit },
    };
  }

  async initiateTopUp(user: any, dto: WalletTopUpDto) {
    if (dto.currency && dto.currency !== 'KES') {
      throw new HttpException('Only KES wallet top-ups are supported for now', HttpStatus.BAD_REQUEST);
    }
    await this.getOrCreateWallet(user.id);

    const paymentIntent = await this.payStackService.createPaymentIntent({
      email: user.email,
      amount: Math.round(dto.amount),
      metaData: {
        purchasingType: PurchasingType.TOP_UP_WALLET,
        userId: user.id,
        amount: dto.amount,
        points: dto.amount,
      },
      callbackUrl: dto.callbackUrl,
    });

    return {
      success: true,
      message: 'Wallet top-up initiated successfully',
      data: paymentIntent,
    };
  }

  async createTopUpWalletPayment(data: any, paystackReference: string) {
    const metadata = data.metadata as any;
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { reference: paystackReference },
    });
    if (existing) return existing;

    const amount = Number(metadata.amount ?? metadata.points ?? 0);
    if (!amount || amount <= 0) return null;

    return this.credit(
      metadata.userId,
      amount,
      'Wallet top-up',
      paystackReference,
      { paystackReference },
    );
  }

  async credit(userId: string, amount: number, description: string, reference?: string, metadata?: Record<string, any>) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: new Decimal(amount),
          balanceAfter: updated.balance,
          description,
          reference,
          metadata: metadata as any,
        },
      });
      return { wallet: updated, transaction };
    });
  }

  async debit(userId: string, amount: number, description: string, reference?: string, metadata?: Record<string, any>) {
    return this.prisma.$transaction((tx) =>
      this.debitInTransaction(tx, userId, amount, description, reference, metadata),
    );
  }

  async debitInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    description: string,
    reference?: string,
    metadata?: Record<string, any>,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < amount) {
      throw new HttpException('Insufficient wallet balance', HttpStatus.BAD_REQUEST);
    }
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount: new Decimal(amount),
        balanceAfter: updated.balance,
        description,
        reference,
        metadata: metadata as any,
      },
    });
    return { wallet: updated, transaction };
  }
}
