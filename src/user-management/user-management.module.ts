import { Module } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.shema';
import { AdminUserManagementController } from './admin-user-management.controller';
import { AdminSettingsController } from './admin.settings.controller';
import { Countries, CountriesSchema } from '@src/schemas/countries.schema';
import { States, StatesSchema } from '@src/schemas/states.schema';
import { Cities, CitiesSchema } from '@src/schemas/cities.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Countries.name,
        schema: CountriesSchema,
      },
      {
        name: States.name,
        schema: StatesSchema,
      },
      {
        name: Cities.name,
        schema: CitiesSchema,
      },
    ]),
  ],
  controllers: [
    UserManagementController,
    AdminUserManagementController,
    AdminSettingsController,
  ],
  providers: [UserManagementService],
})
export class UserManagementModule {}
