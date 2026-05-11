import { Test, TestingModule } from '@nestjs/testing';
import { OnesignalController } from './onesignal.controller';

describe('OnesignalController', () => {
  let controller: OnesignalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnesignalController],
    }).compile();

    controller = module.get<OnesignalController>(OnesignalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
