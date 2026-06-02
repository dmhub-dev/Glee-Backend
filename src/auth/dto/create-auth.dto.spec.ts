import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyLoginTwoFactorDto } from './create-auth.dto';

describe('VerifyLoginTwoFactorDto', () => {
    it('accepts numeric string OTP values from JSON clients', async () => {
        const dto = plainToInstance(VerifyLoginTwoFactorDto, {
            email: 'admin@glee.test',
            otp: '123456',
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.otp).toBe(123456);
    });
});
