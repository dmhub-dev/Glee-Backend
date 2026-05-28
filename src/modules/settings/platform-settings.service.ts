import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { UpdateEventCheckoutSettingsDto } from './dto/event-checkout-settings.dto';

export interface EventCheckoutSettings {
  walletInstallmentDepositType: 'PERCENTAGE' | 'FIXED';
  walletInstallmentDepositPercent: number;
  walletInstallmentDepositAmount: number;
  walletInstallmentSecurityFeeType: 'PERCENTAGE' | 'FIXED';
  walletInstallmentSecurityFeePercent: number;
  walletInstallmentSecurityFeeAmount: number;
}

const EVENT_CHECKOUT_KEY = 'event_checkout';
const DEFAULT_EVENT_CHECKOUT_SETTINGS: EventCheckoutSettings = {
  walletInstallmentDepositType: 'PERCENTAGE',
  walletInstallmentDepositPercent: 30,
  walletInstallmentDepositAmount: 0,
  walletInstallmentSecurityFeeType: 'PERCENTAGE',
  walletInstallmentSecurityFeePercent: 5,
  walletInstallmentSecurityFeeAmount: 0,
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
      walletInstallmentDepositType: this.normalizeFeeType(
        value.walletInstallmentDepositType,
        DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentDepositType,
      ),
      walletInstallmentDepositPercent: this.clampPercent(
        value.walletInstallmentDepositPercent ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentDepositPercent,
        1,
      ),
      walletInstallmentDepositAmount: this.clampAmount(
        value.walletInstallmentDepositAmount ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentDepositAmount,
      ),
      walletInstallmentSecurityFeeType: this.normalizeFeeType(
        value.walletInstallmentSecurityFeeType,
        DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentSecurityFeeType,
      ),
      walletInstallmentSecurityFeePercent: this.clampPercent(
        value.walletInstallmentSecurityFeePercent ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentSecurityFeePercent,
        0,
      ),
      walletInstallmentSecurityFeeAmount: this.clampAmount(
        value.walletInstallmentSecurityFeeAmount ??
          DEFAULT_EVENT_CHECKOUT_SETTINGS.walletInstallmentSecurityFeeAmount,
      ),
    };
  }

  private normalizeFeeType(
    value: unknown,
    fallback: 'PERCENTAGE' | 'FIXED',
  ): 'PERCENTAGE' | 'FIXED' {
    return value === 'FIXED' || value === 'PERCENTAGE' ? value : fallback;
  }

  private clampPercent(value: number, min: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(100, Math.max(min, numeric));
  }

  private clampAmount(value: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, numeric);
  }
}
