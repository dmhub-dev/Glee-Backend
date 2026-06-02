export const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const PAYSTACK_HEADERS = (secretKey: string): Record<string, string> => ({
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
});

export const PAYSTACK_ENDPOINTS = {
  INITIALIZE_TRANSACTION: '/transaction/initialize',
  VERIFY_TRANSACTION: '/transaction/verify',
};
