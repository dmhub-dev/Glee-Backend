import { Module, CacheModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import configuration from './config/configuration';
import { JwtAuthGuard } from './config/auth-guard';
import { PermissionsGuard } from '@src/auth/rbac/permissions.guard';
import { HttpLogInterceptor } from '@src/interceptors/logger.interceptors';
import { PrismaModule } from '@src/prisma/prisma.module';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventModule } from './event/event.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { PaymentModule } from './payment/payment.module';
import { VendorModule } from './vendor/vendor.module';
import { UserManagementModule } from './user-management/user-management.module';
import { BookingsModule } from './bookings/bookings.module';
import { CommonApiModule } from '@src/common.api/common-api.module';
import { SocketModule } from '@src/socket/socket.module';
import { SocketGateway } from '@src/socket/socket.gateway';
import { SocketEventHandler } from '@src/socket/socket_event.handler';
import { NotificationModule } from '@src/notification/notification.module';
import { OnesignalModule } from './onesignal/onesignal.module';
import { EmailModule } from '@src/email-server/email.module';
import { ChatModule } from './chat/chat.module';
import { AppService } from '@src/app.service';
import { PaystackModule } from '@src/paystack/paystack.module';
import { WalletModule } from '@src/wallet/wallet.module';
import { CurrencyModule } from '@src/currency/currency.module';
import { LanguageModule } from '@src/language/language.module';
import { ArtistModule } from '@src/artist/artist.module';
import { ReminderModule } from '@src/reminder/reminder.module';
import { MediaModule } from '@src/media/media.module';
import { CronModule } from '@src/cron/cron.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      load: [configuration],
      envFilePath: `${process.cwd()}/${process.env.NODE_ENV}.env`,
    }),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    HttpModule.register({ timeout: 5000, maxRedirects: 5 }),
    UsersModule,
    AuthModule,
    EventModule,
    CategoriesModule,
    ServicesModule,
    PaymentModule,
    VendorModule,
    UserManagementModule,
    BookingsModule,
    CommonApiModule,
    SocketModule,
    NotificationModule,
    OnesignalModule,
    EmailModule,
    ChatModule,
    PaystackModule,
    WalletModule,
    CurrencyModule,
    LanguageModule,
    ArtistModule,
    ReminderModule,
    MediaModule,
    CronModule,
  ],
  providers: [
    AppService,
    SocketGateway,
    SocketEventHandler,
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
