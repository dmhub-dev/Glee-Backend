import { Module } from '@nestjs/common';
import Database from './database.provider';

@Module({
  imports: [Database],
  exports: [Database],
})
export class DatabaseModule {}
