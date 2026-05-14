import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCurrencyDto) {
    if (dto.exchangeRate <= 0) {
      throw new HttpException('Currency rate must be greater than 0', HttpStatus.BAD_REQUEST);
    }
    return this.prisma.currency.create({ data: dto });
  }

  async findAll() {
    return this.prisma.currency.findMany({ where: { isDeleted: false } });
  }

  async findAllEnabled() {
    return this.prisma.currency.findMany({ where: { isDeleted: false, isEnabled: true } });
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findFirst({ where: { id, isDeleted: false } });
    if (!currency) throw new HttpException('Currency not found', HttpStatus.NOT_FOUND);
    return currency;
  }

  async findByCode(code: string) {
    return this.prisma.currency.findFirst({ where: { code, isDeleted: false } });
  }

  async update(id: string, dto: UpdateCurrencyDto) {
    const currency = await this.prisma.currency.findFirst({ where: { id, isDeleted: false } });
    if (!currency) throw new HttpException('Currency not found', HttpStatus.NOT_FOUND);
    return this.prisma.currency.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const currency = await this.prisma.currency.findFirst({ where: { id, isDeleted: false } });
    if (!currency) throw new HttpException('Currency not found', HttpStatus.NOT_FOUND);
    return this.prisma.currency.update({ where: { id }, data: { isDeleted: true } });
  }

  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    const [source, target] = await Promise.all([
      this.prisma.currency.findFirst({ where: { code: fromCurrency, isEnabled: true, isDeleted: false } }),
      this.prisma.currency.findFirst({ where: { code: toCurrency, isEnabled: true, isDeleted: false } }),
    ]);

    if (!source || !target) throw new HttpException('Invalid currency code', HttpStatus.BAD_REQUEST);

    const amountInUSD = amount / source.exchangeRate;
    return amountInUSD * target.exchangeRate;
  }
}
