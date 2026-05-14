import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async helperCreatePayment(data: {
    userId?: string;
    totalPrice: number;
    perItemPrice: number;
    noOfItems?: number;
    transactionId?: string;
    paystackReference?: string;
    bankAccountNumber?: string;
    vendorId?: string;
    commission?: number;
  }) {
    return this.prisma.payment.create({
      data: {
        userId: data.userId,
        totalPrice: new Decimal(data.totalPrice),
        perItemPrice: new Decimal(data.perItemPrice),
        noOfItems: data.noOfItems ?? 1,
        transactionId: data.transactionId,
        paystackReference: data.paystackReference,
        bankAccountNumber: data.bankAccountNumber,
        vendorId: data.vendorId,
        commission: data.commission ?? 0,
        paymentMethod: 'PAYSTACK',
        paymentStatus: 'PENDING',
      },
    });
  }

  async markPaymentSucceeded(id: string, paystackReference?: string) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        paymentStatus: 'SUCCEEDED',
        paystackReference,
        isPaid: true,
        isAvailable: true,
      },
    });
  }

  async findPaymentByPaystackReference(paystackReference: string) {
    return this.prisma.payment.findUnique({ where: { paystackReference } });
  }
}
