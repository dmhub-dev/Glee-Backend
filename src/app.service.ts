import {
  Injectable,
  HttpException,
  HttpStatus,
  Req,
  OnApplicationBootstrap,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { loggers } from '@src/common/interceptors/logger.enums';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(public configService: ConfigService) {}

  onApplicationBootstrap() {
    // Geo data seeding is now handled by Prisma seed script (prisma/seed.ts)
  }
}
