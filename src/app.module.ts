import { Module, CacheModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import configuration from './config/configuration';
import { JwtAuthGuard } from './auth/jwt/jwt-auth.guard';
import { PermissionsGuard } from '@src/auth/rbac/permissions.guard';
import { HttpLogInterceptor } from '@src/common/interceptors/logger.interceptors';
import { PrismaModule } from '@src/infrastructure/database/prisma.module';

import { UsersModule } from './modules/identity/users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventModule } from './modules/events/event.module';
import { EventTicketsModule } from './modules/tickets/event-tickets.module';
import { CategoriesModule } from './modules/events/categories/categories.module';
import { LocationModule } from './modules/venues/locations/location.module';
import { OnesignalModule } from './infrastructure/push/onesignal/onesignal.module';
import { EmailModule } from '@src/infrastructure/email/email.module';
import { NotificationModule } from './modules/notifications/notifications/notification.module';
import { AppService } from '@src/app.service';
import { AccessManagementModule } from './modules/identity/access-management/access-management.module';
import { WalletModule } from './modules/wallets/wallet/wallet.module';
import { FinanceModule } from './modules/finance/finance/finance.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      load: [configuration],
      envFilePath: [
        `${process.cwd()}/${process.env.NODE_ENV}.env`,
        `${process.cwd()}/.env`,
      ],
    }),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    HttpModule.register({ timeout: 5000, maxRedirects: 5 }),
    UsersModule,
    AuthModule,
    EventModule,
    EventTicketsModule,
    CategoriesModule,
    LocationModule,
    OnesignalModule,
    EmailModule,
    NotificationModule,
    AccessManagementModule,
    WalletModule,
    FinanceModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLogInterceptor,
    },
    {
      provide: APP_GUARD,
      useFactory: (ref) => new JwtAuthGuard(ref),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
