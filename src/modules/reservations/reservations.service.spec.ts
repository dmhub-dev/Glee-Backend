import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import { ReservationsService } from './reservations.service';

describe('ReservationsService setup', () => {
  let service: ReservationsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: PrismaService,
          useValue: {
            location: { findUnique: jest.fn() },
            locationTable: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
            },
            reservationSlot: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
            },
            reservation: {
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            reservationPayment: { create: jest.fn() },
            walletTransaction: { findUnique: jest.fn() },
            $transaction: jest.fn((arg: any) =>
              Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
            ),
          },
        },
        { provide: WalletService, useValue: { debit: jest.fn() } },
      ],
    }).compile();

    service = module.get(ReservationsService);
    prisma = module.get(PrismaService);
  });

  it('creates a table for an owned active location', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      vendorId: 'vendor-1',
      status: 'ACTIVE',
    });
    prisma.locationTable.create.mockResolvedValue({
      id: 'table-1',
      category: 'VIP Booth',
    });

    const result = await service.createTable(
      'loc-1',
      {
        name: 'VIP Booth 1',
        category: 'VIP Booth',
        minGuests: 2,
        maxGuests: 8,
        minimumSpend: 50000,
        depositType: 'FLAT',
        depositValue: 5000,
      } as any,
      { id: 'vendor-1', role: 'VENDOR' },
    );

    expect(result.data.id).toBe('table-1');
    expect(prisma.locationTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId: 'loc-1',
          name: 'VIP Booth 1',
          category: 'VIP Booth',
          isActive: true,
        }),
      }),
    );
  });

  it('blocks vendor from creating table on another vendor location', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      vendorId: 'vendor-2',
      status: 'ACTIVE',
    });

    await expect(
      service.createTable(
        'loc-1',
        {
          name: 'VIP Booth 1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
        } as any,
        { id: 'vendor-1', role: 'VENDOR' },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('creates a location-level reservation slot', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      vendorId: null,
      status: 'ACTIVE',
    });
    prisma.reservationSlot.create.mockResolvedValue({
      id: 'slot-1',
      label: 'Dinner',
    });

    const result = await service.createSlot(
      'loc-1',
      {
        label: 'Dinner',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [4, 5, 6],
      } as any,
      { id: 'admin-1', role: 'ADMIN' },
    );

    expect(result.data.id).toBe('slot-1');
  });
});
