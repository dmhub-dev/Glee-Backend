import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import { ReservationsService } from './reservations.service';

describe('ReservationsService setup', () => {
  let service: ReservationsService;
  let prisma: any;
  let walletService: any;

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
        {
          provide: WalletService,
          useValue: { debit: jest.fn(), debitInTransaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReservationsService);
    prisma = module.get(PrismaService);
    walletService = module.get(WalletService);
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

  it('blocks non-manager roles from reading reservation setup', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      vendorId: null,
      status: 'ACTIVE',
    });

    await expect(
      service.listTables('loc-1', { id: 'support-1', role: 'CUSTOMER_SUPPORT' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects percentage deposits over 100 percent', async () => {
    prisma.location.findUnique.mockResolvedValue({
      id: 'loc-1',
      vendorId: null,
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
          depositType: 'PERCENTAGE',
          depositValue: 150,
        } as any,
        { id: 'admin-1', role: 'ADMIN' },
      ),
    ).rejects.toMatchObject({ status: 400 });
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

  describe('ReservationsService customer booking', () => {
    it('returns available table categories for a date, slot, and guest count', async () => {
      prisma.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        bookingEnabled: true,
        status: 'ACTIVE',
        cancellationCutoffHours: 24,
      });
      prisma.reservationSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        locationId: 'loc-1',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [5],
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
          isActive: true,
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([]);

      const result = await service.getVenueAvailability('loc-1', {
        date: '2026-06-12',
        slotId: 'slot-1',
        guestCount: 4,
      } as any);

      expect(result.data.categories).toEqual([
        expect.objectContaining({
          category: 'VIP Booth',
          availableCount: 1,
          depositAmount: 5000,
          minimumSpend: 50000,
        }),
      ]);
    });

    it('uses the venue timezone when resolving slot instants', async () => {
      prisma.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        bookingEnabled: true,
        status: 'ACTIVE',
        cancellationCutoffHours: 24,
        timezone: 'UTC',
      });
      prisma.reservationSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        locationId: 'loc-1',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [5],
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
          isActive: true,
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([]);

      const result = await service.getVenueAvailability('loc-1', {
        date: '2026-06-12',
        slotId: 'slot-1',
        guestCount: 4,
      } as any);

      expect(result.data.startDateTime.toISOString()).toBe('2026-06-12T18:00:00.000Z');
      expect(result.data.endDateTime.toISOString()).toBe('2026-06-12T20:00:00.000Z');
    });

    it('excludes tables already reserved in overlapping slot', async () => {
      prisma.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        bookingEnabled: true,
        status: 'ACTIVE',
        cancellationCutoffHours: 24,
      });
      prisma.reservationSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        locationId: 'loc-1',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [5],
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
          isActive: true,
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([{ tableId: 'table-1' }]);

      const result = await service.getVenueAvailability('loc-1', {
        date: '2026-06-12',
        slotId: 'slot-1',
        guestCount: 4,
      } as any);

      expect(result.data.categories).toEqual([]);
    });

    it('creates a confirmed wallet reservation with an assigned available table', async () => {
      prisma.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        bookingEnabled: true,
        status: 'ACTIVE',
        cancellationCutoffHours: 24,
      });
      prisma.reservationSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        locationId: 'loc-1',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [5],
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          name: 'A1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
          isActive: true,
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([]);
      walletService.debitInTransaction.mockResolvedValue({
        wallet: { id: 'wallet-1' },
        transaction: { id: 'wallet-tx-1' },
      });
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        tableId: 'table-1',
        status: 'CONFIRMED',
      });
      prisma.reservationPayment.create.mockResolvedValue({ id: 'payment-1' });

      const result = await service.createReservation(
        {
          locationId: 'loc-1',
          slotId: 'slot-1',
          date: '2026-06-12',
          tableCategory: 'VIP Booth',
          guestCount: 4,
          paymentMethod: 'WALLET',
        } as any,
        { id: 'user-1' },
      );

      expect(result.message).toBe('Reservation confirmed successfully');
      expect(walletService.debit).not.toHaveBeenCalled();
      expect(walletService.debitInTransaction).toHaveBeenCalledWith(
        prisma,
        'user-1',
        5000,
        expect.stringContaining('Reservation deposit'),
        expect.stringMatching(/^RSV-/),
        expect.objectContaining({
          locationId: 'loc-1',
          slotId: 'slot-1',
          tableId: 'table-1',
          tableCategory: 'VIP Booth',
          guestCount: 4,
        }),
      );

      const reference = walletService.debitInTransaction.mock.calls[0][4];
      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reference,
            userId: 'user-1',
            locationId: 'loc-1',
            tableId: 'table-1',
            slotId: 'slot-1',
            guestCount: 4,
            tableCategory: 'VIP Booth',
            status: 'CONFIRMED',
            source: 'VENUE',
          }),
        }),
      );
      expect(prisma.reservationPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            amount: expect.anything(),
            method: 'WALLET',
            status: 'SUCCESS',
            reference,
          }),
        }),
      );
    });

    it('assigns the same lowest-deposit category table shown by availability', async () => {
      prisma.location.findUnique.mockResolvedValue({
        id: 'loc-1',
        bookingEnabled: true,
        status: 'ACTIVE',
        cancellationCutoffHours: 24,
      });
      prisma.reservationSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        locationId: 'loc-1',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [5],
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-high',
          name: 'A1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 100000,
          depositType: 'FLAT',
          depositValue: 10000,
          isActive: true,
        },
        {
          id: 'table-low',
          name: 'B1',
          category: 'VIP Booth',
          minGuests: 2,
          maxGuests: 8,
          minimumSpend: 50000,
          depositType: 'FLAT',
          depositValue: 5000,
          isActive: true,
        },
      ]);
      prisma.reservation.findMany.mockResolvedValue([]);
      walletService.debitInTransaction.mockResolvedValue({
        wallet: { id: 'wallet-1' },
        transaction: { id: 'wallet-tx-1' },
      });
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        tableId: 'table-low',
        status: 'CONFIRMED',
      });
      prisma.reservationPayment.create.mockResolvedValue({ id: 'payment-1' });

      const availability = await service.getVenueAvailability('loc-1', {
        date: '2026-06-12',
        slotId: 'slot-1',
        guestCount: 4,
      } as any);

      expect(availability.data.categories[0]).toEqual(
        expect.objectContaining({ minimumSpend: 50000, depositAmount: 5000 }),
      );

      await service.createReservation(
        {
          locationId: 'loc-1',
          slotId: 'slot-1',
          date: '2026-06-12',
          tableCategory: 'VIP Booth',
          guestCount: 4,
          paymentMethod: 'WALLET',
        } as any,
        { id: 'user-1' },
      );

      expect(walletService.debitInTransaction).toHaveBeenLastCalledWith(
        prisma,
        'user-1',
        5000,
        expect.stringContaining('Reservation deposit'),
        expect.any(String),
        expect.objectContaining({ tableId: 'table-low' }),
      );
      expect(prisma.reservation.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tableId: 'table-low' }),
        }),
      );
    });
  });
});
