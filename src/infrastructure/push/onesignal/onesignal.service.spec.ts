import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { OnesignalService } from './onesignal.service';

describe('OnesignalService', () => {
  let service: OnesignalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnesignalService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue({}) },
        },
      ],
    }).compile();

    service = module.get<OnesignalService>(OnesignalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
