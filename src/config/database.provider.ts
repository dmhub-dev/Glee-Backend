import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export default MongooseModule.forRootAsync({
  useFactory: async (configService: ConfigService) => ({
    uri: configService.get<string>('DB_CON_STRING'),
  }),
  inject: [ConfigService],
});

// export const DatabaseProviders = [
//   {
//     provide: 'DATABASE_CONNECTION',
//     inject: [ConfigService],
//     useFactory: (configService: ConfigService) =>
//       MongooseModule.forRoot(configService.get('DB_CON_STRING')),
//     // mongoose.connect(configService.get('DB_CON_STRING')),
//   },
// ];
