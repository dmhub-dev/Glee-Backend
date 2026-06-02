import { generateOtp } from './utils';

describe('generateOtp', () => {
  it('generates a 6 to 8 digit numeric OTP', () => {
    const otp = generateOtp();

    expect(Number.isInteger(otp)).toBe(true);
    expect(otp).toBeGreaterThanOrEqual(100000);
    expect(otp).toBeLessThanOrEqual(99999999);
  });
});
