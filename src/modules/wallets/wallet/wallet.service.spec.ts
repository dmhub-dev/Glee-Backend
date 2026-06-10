import { HttpException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let tx: any;

  beforeEach(() => {
    tx = {
      wallet: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
    };

    service = new WalletService(
      {} as PrismaService,
      {} as PayStackService,
    );
  });

  it('debits with an atomic balance check inside a transaction', async () => {
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      balance: new Decimal(5000),
    });
    tx.walletTransaction.create.mockResolvedValue({ id: 'wallet-tx-1' });

    await service.debitInTransaction(tx, 'user-1', 5000, 'Reservation deposit', 'RSV-1');

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isActive: true,
        balance: { gte: new Decimal(5000) },
      },
      data: { balance: { decrement: new Decimal(5000) } },
    });
  });

  it('rejects debit when the atomic balance update affects no wallet', async () => {
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.debitInTransaction(tx, 'user-1', 5000, 'Reservation deposit', 'RSV-1'),
    ).rejects.toThrow(HttpException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
