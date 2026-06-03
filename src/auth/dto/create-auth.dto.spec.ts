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

    it.each(['12345', '123456789'])(
        'rejects OTP values outside the 6 to 8 digit range',
        async (otp) => {
            const dto = plainToInstance(VerifyLoginTwoFactorDto, {
                email: 'admin@glee.test',
                otp,
            });

            const errors = await validate(dto);

            expect(errors).toHaveLength(1);
            expect(errors[0].property).toBe('otp');
        },
    );
});
