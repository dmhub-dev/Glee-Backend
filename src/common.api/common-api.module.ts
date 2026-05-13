import { Module } from '@nestjs/common';
import { CommonApiController } from './common-api.controller';
import { CommonApi } from '@src/common.api/common-api';

@Module({
  imports: [],
  controllers: [CommonApiController],
  providers: [CommonApi],
})
export class CommonApiModule {}
