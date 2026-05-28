import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { UpdateEventCheckoutSettingsDto } from './dto/event-checkout-settings.dto';

export interface EventCheckoutSettings {
  walletInstallmentDepositPercent: number;
  walletInstallmentSecurityFeePercent: number;
}

const EVENT_CHECKOUT_KEY = 'event_checkout';
const DEFAULT_EVENT_CHECKOUT_SETTINGS: EventCheckoutSettings = {
  walletInstallmentDepositPercent: 30,
  walletInstallmentSecurityFeePercent: 5,
};

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEventCheckoutSettings(): Promise<EventCheckoutSettings> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: EVENT_CHECKOUT_KEY },
    });
    const value = (setting?.value ?? {}) as Partial<EventCheckoutSettings>;
    return this.normalizeEventCheckoutSettings(value);
  }

  async updateEventCheckoutSettings(dto: UpdateEventCheckoutSettingsDto) {
    const value = this.normalizeEventCheckoutSettings(dto);
    const jsonValue = value as unknown as Prisma.InputJsonObject;
    await this.prisma.platformSetting.upsert({
      where: { key: EVENT_CHECKOUT_KEY },
      update: { value: jsonValue },
      create: { key: EVENT_CHECKOUT_KEY, value: jsonValue },
    });

    return {
      success: true,
      message: 'Event checkout settings updated successfully',
      data: value,
    };
  }

  async getPublicEventCheckoutSettings() {
    return {
      success: true,
      message: 'Event checkout settings retrieved successfully',
      data: await this.getEventCheckoutSettings(),
    };
  }

  private normalizeEventCheckoutSettings(
    value: Partial<EventCheckoutSettings>,
  ): EventCheckoutSettings {
    return {
      walletInstallmentDepositPercent: this.clampPercent(
        value.walletInstallmentDepositPercent ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentDepositPercent,
        1,
      ),
      walletInstallmentSecurityFeePercent: this.clampPercent(
        value.walletInstallmentSecurityFeePercent ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentSecurityFeePercent,
        0,
      ),
    };
  }

  private clampPercent(value: number, min: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(100, Math.max(min, numeric));
  }
}
