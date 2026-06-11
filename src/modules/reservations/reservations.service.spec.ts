import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import { ReservationsService } from './reservations.service';

describe('ReservationsService setup', () => {
  let service: ReservationsService;
  let prisma: any;
  let walletService: any;
  let paystack: any;

  beforeEach(async () => {
    paystack = {
      createPaymentIntent: jest.fn(),
      verifyTransaction: jest.fn(),
      verifyTransactionReference: jest.fn(),
      reservationHandler: null,
    };

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
            event: {
              findUnique: jest.fn(),
            },
            eventReservationSlot: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
            },
            reservation: {
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              updateMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            reservationPayment: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
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
        {
          provide: PayStackService,
          useValue: paystack,
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
    it('rejects public Paystack venue reservation without guest fields', async () => {
      await expect(
        service.createReservation(
          {
            locationId: 'loc-1',
            slotId: 'slot-1',
            date: '2026-06-12',
            tableCategory: 'VIP Booth',
            guestCount: 4,
            paymentMethod: 'PAYSTACK',
          } as any,
          null,
        ),
      ).rejects.toThrow(
        'Guest name, email, and phone are required for public reservations',
      );
    });

    it('creates a pending public Paystack venue reservation and payment intent', async () => {
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhone: '+254700000000',
        status: 'PENDING_PAYMENT',
        source: 'VENUE',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({
        id: 'payment-1',
        status: 'PENDING',
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
      paystack.createPaymentIntent.mockResolvedValue({
        authorization_url: 'https://paystack.test/auth',
        reference: 'ps-ref-1',
        verificationToken: 'verify-token',
      });

      const result = await service.createReservation(
        {
          locationId: 'loc-1',
          slotId: 'slot-1',
          date: '2026-06-12',
          tableCategory: 'VIP Booth',
          guestCount: 4,
          paymentMethod: 'PAYSTACK',
          guestName: 'Guest Person',
          guestEmail: 'guest@example.com',
          guestPhone: '+254700000000',
          callbackUrl: 'https://glee.test/reservations/confirm',
        } as any,
        null,
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Reservation payment initialized successfully',
          data: expect.objectContaining({
            reservation: expect.objectContaining({
              id: 'reservation-1',
              status: 'PENDING_PAYMENT',
            }),
            authorization_url: 'https://paystack.test/auth',
            reference: 'ps-ref-1',
            verificationToken: 'verify-token',
          }),
        }),
      );
      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
            status: 'PENDING_PAYMENT',
            source: 'VENUE',
            publicAccessToken: expect.any(String),
          }),
        }),
      );
      expect(prisma.reservationPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId: 'reservation-1',
            userId: null,
            method: 'PAYSTACK',
            status: 'PENDING',
          }),
        }),
      );
      expect(paystack.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          amount: 5000,
          callbackUrl: 'https://glee.test/reservations/confirm',
          metaData: expect.objectContaining({
            purchasingType: 'RESERVATION',
            reservationId: 'reservation-1',
            reservationReference: 'RSV-test',
            source: 'VENUE',
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
          }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservationId: 'reservation-1',
            method: 'PAYSTACK',
            status: 'PENDING',
          }),
          data: { reference: 'ps-ref-1' },
        }),
      );
      expect(walletService.debitInTransaction).not.toHaveBeenCalled();
    });

    it('cleans expired pending Paystack holds before selecting a table', async () => {
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
      prisma.reservation.findMany
        .mockResolvedValueOnce([{ id: 'stale-reservation-1' }])
        .mockResolvedValueOnce([]);
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservationPayment.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhone: '+254700000000',
        status: 'PENDING_PAYMENT',
        source: 'VENUE',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({
        id: 'payment-1',
        status: 'PENDING',
      });
      paystack.createPaymentIntent.mockResolvedValue({
        authorization_url: 'https://paystack.test/auth',
        reference: 'ps-ref-1',
        verificationToken: 'verify-token',
      });

      await service.createReservation(
        {
          locationId: 'loc-1',
          slotId: 'slot-1',
          date: '2026-06-12',
          tableCategory: 'VIP Booth',
          guestCount: 4,
          paymentMethod: 'PAYSTACK',
          guestName: 'Guest Person',
          guestEmail: 'guest@example.com',
          guestPhone: '+254700000000',
        } as any,
        null,
      );

      expect(prisma.reservation.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'loc-1',
            status: 'PENDING_PAYMENT',
            startDateTime: { lt: new Date('2026-06-12T20:00:00.000Z') },
            endDateTime: { gt: new Date('2026-06-12T18:00:00.000Z') },
          }),
          select: { id: true },
        }),
      );
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['stale-reservation-1'] },
            status: 'PENDING_PAYMENT',
          },
          data: {
            status: 'CANCELLED',
            cancellationReason: 'Reservation payment window expired',
          },
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            reservationId: { in: ['stale-reservation-1'] },
            method: 'PAYSTACK',
            status: 'PENDING',
          },
          data: expect.objectContaining({
            status: 'FAILED',
            metadata: expect.objectContaining({
              reason: 'Reservation payment window expired',
            }),
          }),
        }),
      );
      expect(
        prisma.reservation.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.locationTable.findMany.mock.invocationCallOrder[0]);
    });

    it('cancels pending venue reservation when Paystack reference persistence fails', async () => {
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        status: 'PENDING_PAYMENT',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({
        id: 'payment-1',
        status: 'PENDING',
      });
      paystack.createPaymentIntent.mockResolvedValue({
        authorization_url: 'https://paystack.test/auth',
        reference: 'ps-ref-1',
        verificationToken: 'verify-token',
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 0 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createReservation(
          {
            locationId: 'loc-1',
            slotId: 'slot-1',
            date: '2026-06-12',
            tableCategory: 'VIP Booth',
            guestCount: 4,
            paymentMethod: 'PAYSTACK',
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
            callbackUrl: 'https://glee.test/reservations/confirm',
          } as any,
          null,
        ),
      ).rejects.toThrow('Reservation payment could not be initialized');

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('cancels pending venue reservation when Paystack reference update throws', async () => {
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        status: 'PENDING_PAYMENT',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({
        id: 'payment-1',
        status: 'PENDING',
      });
      paystack.createPaymentIntent.mockResolvedValue({
        authorization_url: 'https://paystack.test/auth',
        reference: 'ps-ref-1',
        verificationToken: 'verify-token',
      });
      prisma.reservationPayment.updateMany
        .mockRejectedValueOnce(new Error('reference write failed'))
        .mockResolvedValueOnce({ count: 1 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createReservation(
          {
            locationId: 'loc-1',
            slotId: 'slot-1',
            date: '2026-06-12',
            tableCategory: 'VIP Booth',
            guestCount: 4,
            paymentMethod: 'PAYSTACK',
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
            callbackUrl: 'https://glee.test/reservations/confirm',
          } as any,
          null,
        ),
      ).rejects.toThrow('Reservation payment could not be initialized');

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            reservationId: 'reservation-1',
            method: 'PAYSTACK',
            status: 'PENDING',
          },
          data: expect.objectContaining({
            status: 'FAILED',
            metadata: expect.objectContaining({
              message: 'Reservation payment could not be initialized',
            }),
          }),
        }),
      );
    });

    it('cancels pending venue reservation when Paystack initialization fails', async () => {
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        status: 'PENDING_PAYMENT',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({
        id: 'payment-1',
        status: 'PENDING',
      });
      paystack.createPaymentIntent.mockRejectedValue(new Error('Paystack unavailable'));
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createReservation(
          {
            locationId: 'loc-1',
            slotId: 'slot-1',
            date: '2026-06-12',
            tableCategory: 'VIP Booth',
            guestCount: 4,
            paymentMethod: 'PAYSTACK',
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
          } as any,
          null,
        ),
      ).rejects.toThrow('Paystack unavailable');

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reservationId: 'reservation-1',
            method: 'PAYSTACK',
            status: 'PENDING',
          },
          data: expect.objectContaining({
            status: 'FAILED',
            metadata: expect.objectContaining({ message: 'Paystack unavailable' }),
          }),
        }),
      );
    });

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

    it('cleans expired pending holds before selecting a table for wallet reservations', async () => {
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
      prisma.reservation.findMany
        .mockResolvedValueOnce([{ id: 'stale-reservation-1' }])
        .mockResolvedValueOnce([]);
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
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

      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reservationId: { in: ['stale-reservation-1'] },
            method: 'PAYSTACK',
            status: 'PENDING',
          },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(
        prisma.reservation.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.locationTable.findMany.mock.invocationCallOrder[0]);
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
    it('confirms a pending Paystack reservation payment from a successful webhook', async () => {
      const paystackData = {
        reference: 'ps-ref-1',
        status: 'success',
        amount: 5000,
        currency: 'KES',
        gateway_response: 'Successful',
        paid_at: '2026-06-11T10:00:00.000Z',
        channel: 'card',
        fees: 75,
        authorization: {
          authorization_code: 'AUTH_sensitive',
          reusable: true,
        },
        customer: {
          email: 'guest@example.com',
          customer_code: 'CUS_test',
          phone: '+254700000000',
        },
        metadata: {
          reservationId: 'reservation-1',
          reservationReference: 'RSV-test',
          source: 'VENUE',
          guestPhone: '+254700000000',
          customSecret: 'do-not-store',
        },
      };
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'PENDING',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
        },
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
      });

      const result = await service.confirmReservationPaymentFromPaystack(paystackData);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Reservation payment confirmed successfully',
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CONFIRMED',
          }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1', status: 'PENDING' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            metadata: expect.objectContaining({ reference: 'ps-ref-1' }),
          }),
        }),
      );
      const storedMetadata =
        prisma.reservationPayment.updateMany.mock.calls[0][0].data.metadata;
      expect(storedMetadata).toEqual(
        expect.objectContaining({
          reference: 'ps-ref-1',
          status: 'success',
          amount: 5000,
          currency: 'KES',
          gateway_response: 'Successful',
          paid_at: '2026-06-11T10:00:00.000Z',
          channel: 'card',
          fees: 75,
          customerEmail: 'guest@example.com',
          customerCode: 'CUS_test',
          metadata: expect.objectContaining({
            reservationId: 'reservation-1',
            reservationReference: 'RSV-test',
            source: 'VENUE',
            guestPhone: '+254700000000',
          }),
        }),
      );
      expect(storedMetadata.authorization).toBeUndefined();
      expect(JSON.stringify(storedMetadata)).not.toContain('AUTH_sensitive');
      expect(JSON.stringify(storedMetadata)).not.toContain('customSecret');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: { status: 'CONFIRMED' },
        }),
      );
    });

    it('confirmReservationPayment sanitizes payments metadata in response', async () => {
      paystack.verifyTransactionReference.mockResolvedValue({
        paystack: {
          data: {
            reference: 'ps-ref-1',
            status: 'success',
            authorization: { reusable: true },
          },
        },
      });
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'PENDING',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
        },
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        user: { id: 'user-1', email: 'user@example.com' },
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'SUCCESS',
            reference: 'ps-ref-1',
            metadata: {
              authorization_url: 'https://paystack.test/auth',
              access_code: 'secret-code',
            },
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
      });

      const result: any = await service.confirmReservationPayment({
        reference: 'ps-ref-1',
      } as any);

      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'reservation-1',
          status: 'CONFIRMED',
          guestEmail: 'g***t@example.com',
          guestPhone: '+2547*****456',
          payments: [
            {
              id: 'payment-1',
              amount: 5000,
              method: 'PAYSTACK',
              status: 'SUCCESS',
              reference: 'ps-ref-1',
              createdAt: new Date('2026-06-11T10:00:00.000Z'),
            },
          ],
        }),
      );
      expect(result.data.user).toBeUndefined();
      expect(result.data.payments[0].metadata).toBeUndefined();
    });

    it('cancels expired pending Paystack holds after capture for manual review', async () => {
      const paystackData = {
        reference: 'ps-ref-1',
        status: 'success',
        amount: 5000,
        currency: 'KES',
        authorization: {
          authorization_code: 'AUTH_sensitive',
        },
      };
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'PENDING',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
          createdAt: new Date('2000-01-01T00:00:00.000Z'),
        },
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CANCELLED',
        cancellationReason:
          'Payment captured after reservation hold expired. Manual refund required.',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'SUCCESS',
            reference: 'ps-ref-1',
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
      });

      const result: any = await service.confirmReservationPaymentFromPaystack(paystackData);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Payment captured after reservation hold expired. Manual refund required.',
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CANCELLED',
            cancellationReason:
              'Payment captured after reservation hold expired. Manual refund required.',
          }),
        }),
      );
      expect(prisma.reservationPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            metadata: expect.objectContaining({
              reference: 'ps-ref-1',
              manualReviewRequired: true,
              reason:
                'Payment captured after reservation hold expired. Manual refund required.',
            }),
          }),
        }),
      );
      const storedMetadata =
        prisma.reservationPayment.update.mock.calls[0][0].data.metadata;
      expect(storedMetadata.authorization).toBeUndefined();
      expect(JSON.stringify(storedMetadata)).not.toContain('AUTH_sensitive');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: {
            status: 'CANCELLED',
            cancellationReason:
              'Payment captured after reservation hold expired. Manual refund required.',
          },
        }),
      );
      expect(result.data.payments[0].metadata).toBeUndefined();
    });

    it('records failed payment on expired pending hold as successful manual-review capture', async () => {
      const paystackData = {
        reference: 'ps-ref-1',
        status: 'success',
        amount: 5000,
        currency: 'KES',
        authorization: {
          authorization_code: 'AUTH_sensitive',
        },
        metadata: {
          reservationId: 'reservation-1',
          customSecret: 'do-not-store',
        },
      };
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'FAILED',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
          createdAt: new Date('2000-01-01T00:00:00.000Z'),
          guestEmail: 'guest@example.com',
          guestPhone: '+254700123456',
        },
      });
      prisma.reservationPayment.update.mockResolvedValue({ id: 'payment-1' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CANCELLED',
        cancellationReason:
          'Payment captured after reservation hold expired. Manual refund required.',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'SUCCESS',
            reference: 'ps-ref-1',
            metadata: { authorization_code: 'AUTH_sensitive' },
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
      });

      const result: any = await service.confirmReservationPaymentFromPaystack(paystackData);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Payment captured after reservation hold expired. Manual refund required.',
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CANCELLED',
            guestEmail: 'g***t@example.com',
            guestPhone: '+2547*****456',
          }),
        }),
      );
      expect(prisma.reservationPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            metadata: expect.objectContaining({
              reference: 'ps-ref-1',
              status: 'success',
              manualReviewRequired: true,
              reason:
                'Payment captured after reservation hold expired. Manual refund required.',
            }),
          }),
        }),
      );
      const storedMetadata =
        prisma.reservationPayment.update.mock.calls[0][0].data.metadata;
      expect(storedMetadata.authorization).toBeUndefined();
      expect(JSON.stringify(storedMetadata)).not.toContain('AUTH_sensitive');
      expect(JSON.stringify(storedMetadata)).not.toContain('customSecret');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: {
            status: 'CANCELLED',
            cancellationReason:
              'Payment captured after reservation hold expired. Manual refund required.',
          },
        }),
      );
      expect(result.data.payments[0].metadata).toBeUndefined();
    });

    it('records cleaned-up failed Paystack capture for manual review without throwing', async () => {
      const paystackData = {
        reference: 'ps-ref-1',
        status: 'success',
        amount: 5000,
        currency: 'KES',
        authorization: {
          authorization_code: 'AUTH_sensitive',
        },
        metadata: {
          reservationId: 'reservation-1',
          customSecret: 'do-not-store',
        },
      };
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'FAILED',
        reservation: {
          id: 'reservation-1',
          status: 'CANCELLED',
          cancellationReason: 'Reservation payment window expired',
          guestEmail: 'guest@example.com',
          guestPhone: '+254700123456',
        },
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CANCELLED',
        cancellationReason: 'Reservation payment window expired',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'SUCCESS',
            reference: 'ps-ref-1',
            metadata: { authorization_code: 'AUTH_sensitive' },
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
      });

      await expect(
        service.confirmReservationPaymentFromPaystack(paystackData),
      ).resolves.toEqual(
        expect.objectContaining({
          success: false,
          message: 'Reservation payment requires manual review',
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CANCELLED',
            guestEmail: 'g***t@example.com',
            guestPhone: '+2547*****456',
          }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reference: 'ps-ref-1',
            method: 'PAYSTACK',
          },
          data: expect.objectContaining({
            status: 'SUCCESS',
            metadata: expect.objectContaining({
              reference: 'ps-ref-1',
              status: 'success',
              manualReviewRequired: true,
              reason:
                'Payment captured after reservation was no longer confirmable. Manual refund required.',
            }),
          }),
        }),
      );
      const storedMetadata =
        prisma.reservationPayment.updateMany.mock.calls[0][0].data.metadata;
      expect(storedMetadata.authorization).toBeUndefined();
      expect(JSON.stringify(storedMetadata)).not.toContain('AUTH_sensitive');
      expect(JSON.stringify(storedMetadata)).not.toContain('customSecret');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: {
            status: 'CANCELLED',
            cancellationReason:
              'Payment captured after reservation was no longer confirmable. Manual refund required.',
          },
        }),
      );
    });

    it('cancels reservation for manual review when Paystack success hits an overlap conflict', async () => {
      const overlapError = new Prisma.PrismaClientKnownRequestError(
        'Exclusion constraint failed on reservations_no_table_overlap_active',
        {
          code: 'P2004',
          clientVersion: 'test',
          meta: { constraint: 'reservations_no_table_overlap_active' },
        },
      );
      const paystackData = {
        reference: 'ps-ref-1',
        status: 'success',
        paid_at: '2026-06-11T10:00:00.000Z',
        authorization: {
          authorization_code: 'AUTH_sensitive',
        },
      };
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'PENDING',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
        },
      });
      prisma.reservationPayment.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });
      prisma.reservation.updateMany
        .mockRejectedValueOnce(overlapError)
        .mockResolvedValueOnce({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CANCELLED',
        cancellationReason:
          'Payment captured but table is no longer available. Manual refund required.',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'SUCCESS',
            reference: 'ps-ref-1',
            metadata: {
              ...paystackData,
              manualReviewRequired: true,
            },
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
      });

      const result: any = await service.confirmReservationPaymentFromPaystack(paystackData);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CANCELLED',
            guestEmail: 'g***t@example.com',
            guestPhone: '+2547*****456',
          }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reference: 'ps-ref-1',
            method: 'PAYSTACK',
          },
          data: expect.objectContaining({
            status: 'SUCCESS',
            metadata: expect.objectContaining({
              reference: 'ps-ref-1',
              status: 'success',
              manualReviewRequired: true,
              reason:
                'Payment captured but table is no longer available. Manual refund required.',
            }),
          }),
        }),
      );
      const storedMetadata =
        prisma.reservationPayment.updateMany.mock.calls[1][0].data.metadata;
      expect(storedMetadata.authorization).toBeUndefined();
      expect(JSON.stringify(storedMetadata)).not.toContain('AUTH_sensitive');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: {
            status: 'CANCELLED',
            cancellationReason:
              'Payment captured but table is no longer available. Manual refund required.',
          },
        }),
      );
      expect(result.data.payments[0].metadata).toBeUndefined();
    });

    it('cancels pending reservation when Paystack confirmation fails', async () => {
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'PENDING',
        reservation: {
          id: 'reservation-1',
          status: 'PENDING_PAYMENT',
        },
      });
      prisma.reservationPayment.update.mockResolvedValue({ id: 'payment-1' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirmReservationPaymentFromPaystack({
        reference: 'ps-ref-1',
        status: 'failed',
        gateway_response: 'Declined',
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Reservation payment was not successful',
        }),
      );
      expect(prisma.reservationPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            status: 'FAILED',
            metadata: expect.objectContaining({ reference: 'ps-ref-1' }),
          }),
        }),
      );
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: {
            status: 'CANCELLED',
            cancellationReason: 'Payment was not successful',
          },
        }),
      );
    });

    it('returns confirmed reservation when Paystack confirmation lost a race', async () => {
      prisma.reservationPayment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          reservationId: 'reservation-1',
          method: 'PAYSTACK',
          status: 'PENDING',
          reservation: {
            id: 'reservation-1',
            status: 'PENDING_PAYMENT',
          },
        })
        .mockResolvedValueOnce({
          id: 'payment-1',
          reservationId: 'reservation-1',
          method: 'PAYSTACK',
          status: 'SUCCESS',
          reservation: {
            id: 'reservation-1',
            status: 'CONFIRMED',
          },
        });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.confirmReservationPaymentFromPaystack({
        reference: 'ps-ref-1',
        status: 'success',
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CONFIRMED',
          }),
        }),
      );
      expect(prisma.reservationPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-1', status: 'PENDING' },
        }),
      );
      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });

    it('returns existing reservation without updates for duplicate Paystack success', async () => {
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'SUCCESS',
        reservation: {
          id: 'reservation-1',
          status: 'CONFIRMED',
        },
      });

      const result = await service.confirmReservationPaymentFromPaystack({
        reference: 'ps-ref-1',
        status: 'success',
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'reservation-1' }),
        }),
      );
      expect(prisma.reservationPayment.update).not.toHaveBeenCalled();
      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });

    it('returns manual review for duplicate Paystack success on cancelled manual-review reservation', async () => {
      prisma.reservationPayment.findFirst.mockResolvedValue({
        id: 'payment-1',
        reservationId: 'reservation-1',
        method: 'PAYSTACK',
        status: 'SUCCESS',
        metadata: {
          manualReviewRequired: true,
          reason:
            'Payment captured after reservation was no longer confirmable. Manual refund required.',
        },
        reservation: {
          id: 'reservation-1',
          status: 'CANCELLED',
          cancellationReason:
            'Payment captured after reservation was no longer confirmable. Manual refund required.',
          guestEmail: 'guest@example.com',
          guestPhone: '+254700123456',
        },
      });

      const result = await service.confirmReservationPaymentFromPaystack({
        reference: 'ps-ref-1',
        status: 'success',
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Reservation payment requires manual review',
          data: expect.objectContaining({
            id: 'reservation-1',
            status: 'CANCELLED',
            guestEmail: 'g***t@example.com',
            guestPhone: '+2547*****456',
          }),
        }),
      );
      expect(prisma.reservationPayment.update).not.toHaveBeenCalled();
      expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
    });

    it('masks guest contact fields in public reservation lookup', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        guestName: 'Guest Person',
        guestEmail: 'guest@example.com',
        guestPhone: '+254700123456',
        payments: [
          {
            id: 'payment-1',
            amount: 5000,
            method: 'PAYSTACK',
            status: 'PENDING',
            reference: 'ps-ref-1',
            metadata: { authorization_url: 'https://paystack.test/auth' },
            createdAt: new Date('2026-06-11T10:00:00.000Z'),
          },
        ],
        user: { id: 'user-1', email: 'user@example.com' },
        status: 'CONFIRMED',
      });

      const result = await (service as any).getPublicReservation('public-token');

      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'reservation-1',
          guestName: 'Guest Person',
          guestEmail: 'g***t@example.com',
          guestPhone: '+2547*****456',
          payments: [
            {
              id: 'payment-1',
              amount: 5000,
              method: 'PAYSTACK',
              status: 'PENDING',
              reference: 'ps-ref-1',
              createdAt: new Date('2026-06-11T10:00:00.000Z'),
            },
          ],
        }),
      );
      expect(result.data.user).toBeUndefined();
      expect(result.data.payments[0].metadata).toBeUndefined();
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicAccessToken: 'public-token' },
          include: expect.any(Object),
        }),
      );
    });

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
      prisma.reservation.findFirst
        .mockResolvedValueOnce({
          id: 'reservation-1',
          userId: 'user-1',
          status: 'CONFIRMED',
          cancelBefore: new Date(Date.now() + 60 * 60 * 1000),
        })
        .mockResolvedValueOnce({ id: 'reservation-1', status: 'CANCELLED' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelMyReservation(
        'reservation-1',
        { reason: 'Plans changed' } as any,
        { id: 'user-1' },
      );

      expect(result.data.status).toBe('CANCELLED');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'reservation-1',
            userId: 'user-1',
            status: 'CONFIRMED',
            cancelBefore: { gt: expect.any(Date) },
          }),
        }),
      );
      expect(prisma.reservation.update).not.toHaveBeenCalled();
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
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });
      prisma.reservation.findFirst.mockResolvedValueOnce({
        id: 'reservation-1',
        status: 'CONFIRMED',
        location: { vendorId: null },
      }).mockResolvedValueOnce({ id: 'reservation-1', status: 'NO_SHOW' });

      const result = await service.updateReservationStatus(
        'reservation-1',
        { status: 'NO_SHOW' } as any,
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(result.data.status).toBe('NO_SHOW');
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'CONFIRMED' },
        }),
      );
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('stores admin no-show notes as the operational reservation reason', async () => {
      prisma.reservation.findFirst
        .mockResolvedValueOnce({
          id: 'reservation-1',
          status: 'CONFIRMED',
          location: { vendorId: null },
        })
        .mockResolvedValueOnce({ id: 'reservation-1', status: 'NO_SHOW' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await service.updateReservationStatus(
        'reservation-1',
        { status: 'NO_SHOW', reason: 'Guest did not arrive before cutoff' } as any,
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'NO_SHOW',
            cancellationReason: 'Guest did not arrive before cutoff',
          }),
        }),
      );
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
          where: {
            OR: [
              { location: { vendorId: 'vendor-1' } },
              { event: { vendorId: 'vendor-1' } },
            ],
          },
          include: expect.objectContaining({
            event: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              }),
            }),
            eventSlot: true,
            slot: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
              },
            },
          }),
          skip: 0,
          take: 10,
          orderBy: { startDateTime: 'asc' },
        }),
      );
    });

    it('includes vendor-owned event reservations at platform locations in vendor listings', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.count.mockResolvedValue(0);

      await service.listAdminReservations(
        { id: 'vendor-1', role: 'VENDOR' },
        {} as any,
      );

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { location: { vendorId: 'vendor-1' } },
              { event: { vendorId: 'vendor-1' } },
            ],
          }),
        }),
      );
    });

    it('lets vendors update reservations for their own events at platform locations', async () => {
      prisma.reservation.findFirst
        .mockResolvedValueOnce({
          id: 'reservation-1',
          status: 'CONFIRMED',
          location: { vendorId: null },
          event: { vendorId: 'vendor-1' },
        })
        .mockResolvedValueOnce({ id: 'reservation-1', status: 'SEATED' });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await service.updateReservationStatus(
        'reservation-1',
        { status: 'SEATED' } as any,
        { id: 'vendor-1', role: 'VENDOR' },
      );

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'CONFIRMED' },
        }),
      );
    });

    it('filters admin reservation listing by reservation source', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      prisma.reservation.count.mockResolvedValue(0);

      await service.listAdminReservations(
        { id: 'admin-1', role: 'ADMIN' },
        { source: 'EVENT' } as any,
      );

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'EVENT' }),
        }),
      );
      expect(prisma.reservation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'EVENT' }),
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

    it('gets admin reservation detail with vendor scope and safe customer fields', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
        location: { vendorId: 'vendor-1' },
        user: { id: 'user-1', name: 'Customer', email: 'user@example.com' },
      });

      const result = await service.getAdminReservation(
        'reservation-1',
        { id: 'vendor-1', role: 'VENDOR' },
      );

      expect(result.data.id).toBe('reservation-1');
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1' },
          include: expect.objectContaining({
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                profileImage: true,
              },
            },
          }),
        }),
      );
    });

    it('blocks stale admin status updates after a concurrent status change', async () => {
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'reservation-1',
        status: 'CONFIRMED',
        location: { vendorId: null },
      });
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateReservationStatus(
          'reservation-1',
          { status: 'NO_SHOW' } as any,
          { id: 'admin-1', role: 'ADMIN' },
        ),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('ReservationsService event-linked reservations', () => {
    it('creates an event-specific reservation slot for the event owner', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        vendorId: 'vendor-1',
        startDate: new Date('2026-06-12T18:00:00.000Z'),
        endDate: new Date('2026-06-13T02:00:00.000Z'),
        location: { id: 'loc-1', vendorId: 'vendor-1' },
      });
      prisma.eventReservationSlot.create.mockResolvedValue({
        id: 'event-slot-1',
        eventId: 'event-1',
        label: 'Event VIP Window',
      });

      const result = await service.createEventSlot(
        'event-1',
        {
          label: 'Event VIP Window',
          startDateTime: '2026-06-12T20:00:00.000Z',
          endDateTime: '2026-06-12T23:00:00.000Z',
        } as any,
        { id: 'vendor-1', role: 'VENDOR' },
      );

      expect(result.data.id).toBe('event-slot-1');
      expect(prisma.eventReservationSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 'event-1',
            label: 'Event VIP Window',
            startDateTime: new Date('2026-06-12T20:00:00.000Z'),
            endDateTime: new Date('2026-06-12T23:00:00.000Z'),
            isActive: true,
          }),
        }),
      );
    });

    it('blocks event reservation slots outside the event date window', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        vendorId: 'vendor-1',
        startDate: new Date('2026-06-12T18:00:00.000Z'),
        endDate: new Date('2026-06-13T02:00:00.000Z'),
        location: { id: 'loc-1', vendorId: 'vendor-1' },
      });

      await expect(
        service.createEventSlot(
          'event-1',
          {
            label: 'Wrong day',
            startDateTime: '2026-06-15T20:00:00.000Z',
            endDateTime: '2026-06-15T23:00:00.000Z',
          } as any,
          { id: 'vendor-1', role: 'VENDOR' },
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(prisma.eventReservationSlot.create).not.toHaveBeenCalled();
    });

    it('hides public event reservation slots when the location is not booking enabled', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'ACTIVE',
        isDeleted: false,
        location: {
          id: 'loc-1',
          bookingEnabled: false,
          status: 'ACTIVE',
        },
      });

      await expect(service.listEventSlots('event-1')).rejects.toMatchObject({
        status: 404,
      });
      expect(prisma.eventReservationSlot.findMany).not.toHaveBeenCalled();
    });

    it('uses event slot date range for event reservation availability', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'ACTIVE',
        isDeleted: false,
        location: {
          id: 'loc-1',
          bookingEnabled: true,
          status: 'ACTIVE',
        },
      });
      prisma.eventReservationSlot.findFirst.mockResolvedValue({
        id: 'event-slot-1',
        eventId: 'event-1',
        startDateTime: new Date('2026-06-12T20:00:00.000Z'),
        endDateTime: new Date('2026-06-12T23:00:00.000Z'),
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

      const result = await service.getEventAvailability(
        'event-1',
        { eventSlotId: 'event-slot-1', guestCount: 4 } as any,
      );

      expect(result.data.categories[0]).toEqual(
        expect.objectContaining({ category: 'VIP Booth', availableCount: 1 }),
      );
      expect(result.data.startDateTime).toEqual(
        new Date('2026-06-12T20:00:00.000Z'),
      );
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'loc-1',
            startDateTime: { lt: new Date('2026-06-12T23:00:00.000Z') },
            endDateTime: { gt: new Date('2026-06-12T20:00:00.000Z') },
          }),
        }),
      );
      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            eventId: expect.anything(),
          }),
        }),
      );
    });

    it('excludes location table conflicts from other reservation sources', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'ACTIVE',
        isDeleted: false,
        location: {
          id: 'loc-1',
          bookingEnabled: true,
          status: 'ACTIVE',
        },
      });
      prisma.eventReservationSlot.findFirst.mockResolvedValue({
        id: 'event-slot-1',
        eventId: 'event-1',
        startDateTime: new Date('2026-06-12T20:00:00.000Z'),
        endDateTime: new Date('2026-06-12T23:00:00.000Z'),
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

      const result = await service.getEventAvailability(
        'event-1',
        { eventSlotId: 'event-slot-1', guestCount: 4 } as any,
      );

      expect(result.data.categories).toEqual([]);
    });

    it('blocks public event availability for deleted or non-public events', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'DRAFT',
        isDeleted: false,
        location: {
          id: 'loc-1',
          bookingEnabled: true,
          status: 'ACTIVE',
        },
      });

      await expect(
        service.getEventAvailability(
          'event-1',
          { eventSlotId: 'event-slot-1', guestCount: 4 } as any,
        ),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('creates a confirmed wallet reservation for an event slot', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'ACTIVE',
        isDeleted: false,
        location: {
          id: 'loc-1',
          name: 'Glee Lounge',
          bookingEnabled: true,
          status: 'ACTIVE',
          cancellationCutoffHours: 24,
        },
      });
      prisma.eventReservationSlot.findFirst.mockResolvedValue({
        id: 'event-slot-1',
        eventId: 'event-1',
        startDateTime: new Date('2026-06-12T20:00:00.000Z'),
        endDateTime: new Date('2026-06-12T23:00:00.000Z'),
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          name: 'VIP 1',
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
        eventId: 'event-1',
        eventSlotId: 'event-slot-1',
        status: 'CONFIRMED',
        source: 'EVENT',
      });
      prisma.reservationPayment.create.mockResolvedValue({ id: 'payment-1' });

      const result = await service.createEventReservation(
        'event-1',
        {
          eventSlotId: 'event-slot-1',
          tableCategory: 'VIP Booth',
          guestCount: 4,
          paymentMethod: 'WALLET',
        } as any,
        { id: 'user-1' },
      );

      expect(result.data.source).toBe('EVENT');
      expect(walletService.debitInTransaction).toHaveBeenCalledWith(
        prisma,
        'user-1',
        5000,
        expect.stringContaining('Event reservation deposit'),
        expect.stringMatching(/^RSV-/),
        expect.objectContaining({
          eventId: 'event-1',
          eventSlotId: 'event-slot-1',
          locationId: 'loc-1',
          tableId: 'table-1',
          tableCategory: 'VIP Booth',
        }),
      );
      expect(prisma.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 'event-1',
            eventSlotId: 'event-slot-1',
            locationId: 'loc-1',
            tableId: 'table-1',
            source: 'EVENT',
            status: 'CONFIRMED',
          }),
        }),
      );
    });

    it('cancels pending event reservation when Paystack reference persistence fails', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        locationId: 'loc-1',
        status: 'ACTIVE',
        isDeleted: false,
        location: {
          id: 'loc-1',
          name: 'Glee Lounge',
          bookingEnabled: true,
          status: 'ACTIVE',
          cancellationCutoffHours: 24,
        },
      });
      prisma.eventReservationSlot.findFirst.mockResolvedValue({
        id: 'event-slot-1',
        eventId: 'event-1',
        startDateTime: new Date('2026-06-12T20:00:00.000Z'),
        endDateTime: new Date('2026-06-12T23:00:00.000Z'),
      });
      prisma.locationTable.findMany.mockResolvedValue([
        {
          id: 'table-1',
          name: 'VIP 1',
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
      prisma.reservation.create.mockResolvedValue({
        id: 'reservation-1',
        reference: 'RSV-test',
        eventId: 'event-1',
        eventSlotId: 'event-slot-1',
        status: 'PENDING_PAYMENT',
        source: 'EVENT',
        depositAmount: 5000,
      });
      prisma.reservationPayment.create.mockResolvedValue({ id: 'payment-1' });
      paystack.createPaymentIntent.mockResolvedValue({
        authorization_url: 'https://paystack.test/auth',
        reference: 'ps-ref-1',
        verificationToken: 'verify-token',
      });
      prisma.reservationPayment.updateMany.mockResolvedValue({ count: 0 });
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createEventReservation(
          'event-1',
          {
            eventSlotId: 'event-slot-1',
            tableCategory: 'VIP Booth',
            guestCount: 4,
            paymentMethod: 'PAYSTACK',
            guestName: 'Guest Person',
            guestEmail: 'guest@example.com',
            guestPhone: '+254700000000',
            callbackUrl: 'https://glee.test/reservations/confirm',
          } as any,
          null,
        ),
      ).rejects.toThrow('Reservation payment could not be initialized');

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1', status: 'PENDING_PAYMENT' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('keeps pending Paystack reservations in the DB overlap exclusion constraint', () => {
      const migration = readFileSync(
        join(
          process.cwd(),
          'prisma/migrations/20260611100000_add_public_reservation_paystack_fields/migration.sql',
        ),
        'utf8',
      );

      expect(migration).toContain(
        `WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'SEATED'))`,
      );
    });
  });
});
