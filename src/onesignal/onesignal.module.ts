import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.shema';
import { OnesignalController } from './onesignal.controller';
import { OnesignalHttpModule } from './onesignal.provider';
import { OnesignalService } from './onesignal.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [OnesignalController],
  providers: [OnesignalService],
  exports: [OnesignalService],
})
export class OnesignalModule {}
