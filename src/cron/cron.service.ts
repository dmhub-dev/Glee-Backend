import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async processPayouts() {
    this.logger.log('Running payout availability check...');

    const vendors = await this.prisma.vendor.findMany({
      where: { isDeleted: false, status: 'ACTIVE' },
      select: { id: true },
    });

    for (const vendor of vendors) {
      await this.prisma.payment.updateMany({
        where: { vendorId: vendor.id, isAvailable: false, isPaid: false, paymentStatus: 'SUCCEEDED' },
        data: { isAvailable: true },
      });
    }

    this.logger.log('Payout availability check complete.');
  }
}
