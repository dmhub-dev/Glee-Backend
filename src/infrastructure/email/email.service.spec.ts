import { EmailService } from './email.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('EmailService sender routing', () => {
  let service: EmailService;

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          RESEND_API_KEY: 'test-key',
          EMAIL_FROM_NO_REPLY: 'Glee <no-reply@dmhub.cloud>',
          EMAIL_FROM_TICKETS: 'Glee Tickets <tickets@dmhub.cloud>',
          EMAIL_FROM_SUPPORT: 'Glee Support <support@dmhub.cloud>',
          EMAIL_FROM_FINANCE: 'Glee Finance <finance@dmhub.cloud>',
        };
        return values[key];
      }),
    };

    service = new EmailService(config as any, {} as any);
  });

  it('uses no-reply sender for authentication emails', async () => {
    await service.sendMail({
      template: 'emails/auth/two-factor',
      message: { to: 'user@example.com', subject: 'Login code' },
      locals: { code: 123456, name: 'Jane' },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee <no-reply@dmhub.cloud>',
      }),
    );
  });

  it('uses ticket sender for ticket delivery emails', async () => {
    await service.sendMail({
      template: 'emails/event/event-ticket',
      message: { to: 'user@example.com', subject: 'Your ticket' },
      locals: {
        purchasedOn: 'June 2, 2026',
        userEmail: 'user@example.com',
        userName: 'Jane',
        ticketId: 'ORDER-1',
        productTitle: 'Glee Night',
        eventDate: 'June 2, 2026',
        eventTime: '8:00 PM',
        eventVenue: 'Nairobi',
        total: '100',
        orderTotal: '100',
        subTotal: '100',
        menuItems: [],
        menuTotal: null,
        noOfItems: 1,
        orderType: 'Event',
      },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee Tickets <tickets@dmhub.cloud>',
      }),
    );
  });

  it('uses support sender for vendor workflow emails', async () => {
    await service.sendMail({
      template: 'emails/event/vendor-event-submitted',
      message: { to: 'admin@example.com', subject: 'Pending event' },
      locals: {
        eventName: 'Glee Night',
        vendorName: 'Vendor',
        vendorEmail: 'vendor@example.com',
        eventDate: '2026-06-02',
      },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee Support <support@dmhub.cloud>',
      }),
    );
  });

  it('renders vendor approval email with support sender', async () => {
    await service.sendMail({
      template: 'emails/event/vendor-event-reviewed',
      message: { to: 'vendor@example.com', subject: 'Your event is live' },
      locals: {
        eventName: 'Glee Night',
        vendorName: 'Vendor',
        approved: true,
        reason: '',
        eventUrl: 'https://admin.glee.test/events/1',
        year: 2026,
      },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee Support <support@dmhub.cloud>',
        html: expect.stringContaining('Your event is live'),
      }),
    );
  });

  it('renders vendor rejection email with support sender', async () => {
    await service.sendMail({
      template: 'emails/event/vendor-event-reviewed',
      message: { to: 'vendor@example.com', subject: 'Your event needs changes' },
      locals: {
        eventName: 'Glee Night',
        vendorName: 'Vendor',
        approved: false,
        reason: 'Please add clearer event photos.',
        eventUrl: 'https://admin.glee.test/events/1',
        year: 2026,
      },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee Support <support@dmhub.cloud>',
        html: expect.stringContaining('Please add clearer event photos.'),
      }),
    );
  });

  it('allows explicit finance sender for finance emails', async () => {
    await service.sendMail({
      template: 'emails/auth/two-factor',
      sender: 'finance',
      message: { to: 'user@example.com', subject: 'Wallet top-up' },
      locals: { code: 123456, name: 'Jane' },
    } as any);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Glee Finance <finance@dmhub.cloud>',
      }),
    );
  });

  it.each([
    [
      'emails/auth/signup-token',
      {
        name: 'Jane',
        otp: 123456,
        date: 2026,
      },
      'Glee <no-reply@dmhub.cloud>',
      'no-reply@dmhub.cloud',
    ],
    [
      'emails/auth/forgot-password',
      {
        config: { APP_NAME: 'Glee' },
        user: { name: 'Jane' },
        otp: 123456,
        date: 2026,
      },
      'Glee <no-reply@dmhub.cloud>',
      'no-reply@dmhub.cloud',
    ],
    [
      'emails/auth/reset-password',
      {
        config: { APP_NAME: 'Glee' },
        user: { name: 'Jane' },
        date: 2026,
      },
      'Glee <no-reply@dmhub.cloud>',
      'no-reply@dmhub.cloud',
    ],
    [
      'emails/auth/invite-user',
      {
        name: 'Jane',
        role: 'ADMIN',
        link: 'https://admin.glee.test/invitations/accept/token',
        date: 2026,
      },
      'Glee Support <support@dmhub.cloud>',
      'no-reply@dmhub.cloud',
    ],
  ])('renders %s with expected sender', async (template, locals, expectedFrom, expectedEmail) => {
    await service.sendMail({
      template,
      message: { to: 'user@example.com', subject: 'Auth email' },
      locals,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expectedFrom,
        html: expect.stringContaining(expectedEmail),
      }),
    );
  });
});
