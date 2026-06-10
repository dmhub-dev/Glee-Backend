import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLocationDto } from './create-location.dto';
import { UpdateLocationDto } from './update-location.dto';

describe('Location reservation DTO validation', () => {
  it.each([
    ['create', CreateLocationDto],
    ['update', UpdateLocationDto],
  ])('rejects fractional cancellation cutoff hours on %s dto', async (_name, DtoClass) => {
    const dto = plainToInstance(DtoClass, {
      cancellationCutoffHours: 1.5,
    });

    const errors = await validate(dto, { skipMissingProperties: true });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'cancellationCutoffHours',
        }),
      ]),
    );
  });
});
