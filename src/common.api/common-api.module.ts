import { Module } from '@nestjs/common';
import { CommonApiController } from './common-api.controller';
import { CommonApi } from '@src/common.api/common-api';
import { MongooseModule } from '@nestjs/mongoose';
import { Events, EventSchema } from '@src/schemas/events.schema';
import { Service, ServiceSchema } from '@src/schemas/services.schema';
import { Booking, BookingSchema } from '@src/schemas/booking.schema';
import { User, UserSchema } from '@src/schemas/user.shema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Events.name,
        schema: EventSchema,
      },
      {
        name: Service.name,
        schema: ServiceSchema,
      },
      {
        name: Booking.name,
        schema: BookingSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [CommonApiController],
  providers: [CommonApi],
})
export class CommonApiModule {}
