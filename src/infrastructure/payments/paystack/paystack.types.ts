export enum PurchasingType {
  BOOKING = 'BOOKING',
  EVENT_TICKET = 'EVENT_TICKET',
  PURCHASED_SERVICE = 'SERVICE',
  TOP_UP_WALLET = 'TOP_UP_WALLET',
  PURCHASE_BOOKING_WITH_CASH_DEPOSIT = 'PURCHASE_BOOKING_WITH_CASH_DEPOSIT',
  PURCHASE_EVENT_WITH_CASH_DEPOSIT = 'PURCHASE_EVENT_WITH_CASH_DEPOSIT',
}

export enum PaystackEvent {
  CHARGE_SUCCESS = 'charge.success',
  CHARGE_FAILED = 'charge.failed',
}

export interface ServiceMetadata {
  purchasingType: PurchasingType.PURCHASED_SERVICE;
  serviceId: string;
  totalPerson?: number;
  price?: string;
  totalPrice?: string;
  userId?: string;
  date?: Date;
}

export interface BookingMetadata {
  purchasingType: PurchasingType.BOOKING;
  bookingId: string;
  bookingType?: string;
  tableId?: string;
  preOrderMenu?: any[];
  userId?: string;
}

export interface EventTicketMetadata {
  purchasingType: PurchasingType.EVENT_TICKET;
  eventId: string;
  noOfTickets: number;
  ticketCategoryId?: string;
  preOrderMenu?: any[];
  userId?: string;
}

export interface TopUpWalletMetadata {
  purchasingType: PurchasingType.TOP_UP_WALLET;
  userId: string;
  amount: number;
  points: number;
}

export interface PurchaseBookingWithCashMetadata {
  purchasingType: PurchasingType.PURCHASE_BOOKING_WITH_CASH_DEPOSIT;
  bookingId: string;
  userId: string;
  depositAmount: number;
  bookingType?: string;
  tableId?: string;
}

export interface PurchaseEventWithCashMetadata {
  purchasingType: PurchasingType.PURCHASE_EVENT_WITH_CASH_DEPOSIT;
  eventId: string;
  userId: string;
  depositAmount: number;
  noOfTickets: number;
  ticketCategoryId?: string;
}

export type PaystackMetadata =
  | Record<string, never>
  | ServiceMetadata
  | EventTicketMetadata
  | BookingMetadata
  | TopUpWalletMetadata
  | PurchaseBookingWithCashMetadata
  | PurchaseEventWithCashMetadata;

export interface PaystackWebhookData {
  id: number;
  domain: string;
  status: string;
  reference: string;
  amount: number;
  message: string | null;
  gateway_response: string;
  paid_at: string;
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string;
  metadata: PaystackMetadata;
  fees: number;
  authorization: {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    channel: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    reusable: boolean;
    signature: string;
  };
  customer: {
    id: number;
    email: string;
    customer_code: string;
  };
}

export interface PaystackWebhookPayload {
  event: PaystackEvent;
  data: PaystackWebhookData;
}

export interface PaystackInitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: PaystackInitializeData;
}

export interface PaystackVerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    gateway_response: string;
    metadata: any;
    customer: any;
    [key: string]: any;
  };
}
