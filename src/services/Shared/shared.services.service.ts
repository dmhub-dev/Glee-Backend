import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class ServiceSharedService {
  constructor(private readonly prisma: PrismaService) {}

  async helperServiceFindById(id: string) {
    return this.prisma.service.findFirst({
      where: { id, isDeleted: false },
      include: { vendor: true },
    });
  }

  async calculateServiceEarning(serviceId: string) {
    const items = await this.prisma.purchasedService.findMany({
      where: { serviceId },
      include: { payment: true },
    });
    if (!items.length) return [];
    const grandTotal = items.reduce((sum, t) => sum + Number(t.payment?.totalPrice ?? 0), 0);
    return [{ _id: serviceId, grandTotal, adminEarning: 0, vendorEarning: grandTotal }];
  }
}
