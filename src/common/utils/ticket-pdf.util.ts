import * as QRCode from 'qrcode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface TicketPdfOptions {
  ticketRef: string;
  ticketNumber: number;
  totalTickets: number;
  eventName: string;
  eventDate: string | null;
  eventTime: string | null;
  eventVenue: string | null;
  attendeeName: string;
  attendeeEmail: string;
  purchasedOn: string;
  orderId: string;
  price: string;
  currency?: string;
}

export async function generateTicketPdf(opts: TicketPdfOptions): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(opts.ticketRef, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImageBuffer = Buffer.from(
    qrDataUrl.replace(/^data:image\/png;base64,/, ''),
    'base64',
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Ticket — ${opts.eventName}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;
    const currency = opts.currency ?? 'KES';

    // ── Header band ──────────────────────────────────────────
    doc.rect(0, 0, W, 160).fill('#1a0533');

    // Eyebrow
    doc
      .fillColor('#a78bfa')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`EVENT TICKET  ·  ${opts.totalTickets > 1 ? `${opts.ticketNumber} OF ${opts.totalTickets}` : 'ENTRY'}`, 40, 30, { characterSpacing: 2 });

    // Event name
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(opts.eventName, 40, 50, { width: W - 80, lineGap: 4 });

    // Meta line
    const metaParts: string[] = [];
    if (opts.eventDate) metaParts.push(opts.eventDate);
    if (opts.eventTime) metaParts.push(opts.eventTime);
    if (opts.eventVenue) metaParts.push(opts.eventVenue);
    if (metaParts.length) {
      doc
        .fillColor('rgba(255,255,255,0.75)')
        .font('Helvetica')
        .fontSize(10)
        .text(metaParts.join('  ·  '), 40, 105, { width: W - 80 });
    }

    // ── Gradient accent strip ─────────────────────────────────
    // PDFKit doesn't support CSS gradients, so use a solid strip
    doc.rect(0, 160, W, 4).fill('#7B2FBE');

    // ── White body ───────────────────────────────────────────
    doc.rect(0, 164, W, 476).fill('#FFFFFF');

    // ── Attendee details (left column) ───────────────────────
    const bodyY = 192;
    const col1X = 48;
    const col2X = 340;

    const field = (label: string, value: string, y: number, x = col1X, maxWidth = 260) => {
      doc
        .fillColor('#9ca3af')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(label.toUpperCase(), x, y, { characterSpacing: 1.5 });
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(value, x, y + 14, { width: maxWidth, lineGap: 2 });
    };

    field('Attendee', opts.attendeeName, bodyY);
    field('Email', opts.attendeeEmail, bodyY + 56);
    field('Purchase Date', opts.purchasedOn, bodyY + 112);

    if (opts.eventDate) {
      field('Event Date', opts.eventDate + (opts.eventTime ? `  ${opts.eventTime}` : ''), bodyY + 168);
    }

    if (opts.eventVenue) {
      field('Venue', opts.eventVenue, bodyY + (opts.eventDate ? 230 : 168));
    }

    field('Price', `${currency} ${opts.price}`, bodyY + (opts.eventVenue ? (opts.eventDate ? 286 : 224) : (opts.eventDate ? 230 : 168)));

    // ── QR code (right column) ────────────────────────────────
    const qrSize = 160;
    const qrX = col2X;
    const qrY = bodyY;

    doc.rect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 48).fillAndStroke('#FAFBFF', '#e9d5ff');
    doc.image(qrImageBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fillColor('#9ca3af')
      .font('Helvetica')
      .fontSize(8)
      .text('Scan at entrance', qrX, qrY + qrSize + 10, { width: qrSize, align: 'center' });

    // ── Dashed tear line ──────────────────────────────────────
    const tearY = 164 + 380;
    doc.save();
    doc.moveTo(40, tearY).lineTo(W - 40, tearY).dash(6, { space: 4 }).stroke('#e5e7eb');
    doc.restore();

    // ── Reference stub ────────────────────────────────────────
    const stubY = tearY + 16;
    doc
      .fillColor('#9ca3af')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('TICKET ID', 0, stubY, { width: W, align: 'center', characterSpacing: 2 });
    doc
      .fillColor('#7B2FBE')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(opts.orderId, 0, stubY + 14, { width: W, align: 'center', characterSpacing: 2.5 });

    if (opts.totalTickets > 1) {
      doc
        .fillColor('#6b7280')
        .font('Helvetica')
        .fontSize(9)
        .text(`Ticket ${opts.ticketNumber} of ${opts.totalTickets}`, 0, stubY + 32, { width: W, align: 'center' });
    }

    // ── Footer band ───────────────────────────────────────────
    doc.rect(0, 640 + 200, W, 60).fill('#f9fafb');
    doc
      .fillColor('#9ca3af')
      .font('Helvetica')
      .fontSize(9)
      .text('© 2026 Glee  ·  Non-transferable  ·  One-time entry  ·  support@gleeapp.co', 0, 640 + 214, {
        width: W,
        align: 'center',
      });

    doc.end();
  });
}
