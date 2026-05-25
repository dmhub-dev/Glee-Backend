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
import { EventTicketsModule } from './event/event-tickets/event-tickets.module';
import { CategoriesModule } from './categories/categories.module';
import { LocationModule } from './location/location.module';
import { OnesignalModule } from './onesignal/onesignal.module';
import { EmailModule } from '@src/email-server/email.module';
import { NotificationModule } from './notification/notification.module';
import { AppService } from '@src/app.service';

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
