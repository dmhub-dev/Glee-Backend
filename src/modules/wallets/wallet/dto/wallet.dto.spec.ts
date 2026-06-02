import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WalletTransactionsQueryDto } from './wallet.dto';

describe('WalletTransactionsQueryDto', () => {
  it('accepts numeric query string values for pagination', async () => {
    const dto = plainToInstance(WalletTransactionsQueryDto, {
      page: '1',
      limit: '100',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(100);
  });
});
