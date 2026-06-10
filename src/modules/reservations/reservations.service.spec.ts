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

  describe('ReservationsService reservation reads and statuses', () => {
    it('lists current customer reservations', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'reservation-1', userId: 'user-1', status: 'CONFIRMED' },
      ]);
      prisma.reservation.count.mockResolvedValue(1);

      const result = await service.listMyReservations(
        { id: 'user-1' },
        { page: 1, limit: 10, status: 'CONFIRMED' } as any,
      );

      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'CONFIRMED' },
          skip: 0,
          take: 10,
          orderBy: { startDateTime: 'desc' },
        }),
      );
    });

    it('gets a current customer reservation', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        userId: 'user-1',
        status: 'CONFIRMED',
      });

      const result = await service.getMyReservation('reservation-1', { id: 'user-1' });

      expect(result.data.id).toBe('reservation-1');
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', userId: 'user-1' },
        }),
      );
    });

    it('allows customer cancellation before cutoff', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        cancelBefore: new Date(Date.now() + 60 * 60 * 1000),
      });
      prisma.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'CANCELLED' });

      const result = await service.cancelMyReservation(
        'reservation-1',
        { reason: 'Plans changed' } as any,
        { id: 'user-1' },
      );

      expect(result.data.status).toBe('CANCELLED');
    });

    it('blocks customer cancellation after cutoff', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        cancelBefore: new Date(Date.now() - 60 * 60 * 1000),
      });

      await expect(
        service.cancelMyReservation('reservation-1', {}, { id: 'user-1' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('lets admin mark reservation no-show', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
        location: { vendorId: null },
      });
      prisma.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'NO_SHOW' });

      const result = await service.updateReservationStatus(
        'reservation-1',
        { status: 'NO_SHOW' } as any,
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(result.data.status).toBe('NO_SHOW');
    });

    it('blocks vendor from updating another vendor location reservation', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
        location: { vendorId: 'vendor-2' },
      });

      await expect(
        service.updateReservationStatus(
          'reservation-1',
          { status: 'NO_SHOW' } as any,
          { id: 'vendor-1', role: 'VENDOR' },
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('scopes vendor reservation listing to own locations', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        {
          id: 'reservation-1',
          status: 'CONFIRMED',
          location: { vendorId: 'vendor-1' },
        },
      ]);
      prisma.reservation.count.mockResolvedValue(1);

      const result = await service.listAdminReservations(
        { id: 'vendor-1', role: 'VENDOR' },
        { page: 1, limit: 10 } as any,
      );

      expect(result.data.items).toHaveLength(1);
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { location: { vendorId: 'vendor-1' } },
          skip: 0,
          take: 10,
          orderBy: { startDateTime: 'asc' },
        }),
      );
    });

    it('filters admin reservations by start time for the requested calendar date', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.count.mockResolvedValue(0);

      await service.listAdminReservations(
        { id: 'admin-1', role: 'ADMIN' },
        { date: '2026-06-12', page: 1, limit: 10 } as any,
      );

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDateTime: {
              gte: new Date('2026-06-12T00:00:00.000Z'),
              lt: new Date('2026-06-13T00:00:00.000Z'),
            },
          }),
        }),
      );
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            reservationDate: expect.anything(),
          }),
        }),
      );
    });
  });
});
