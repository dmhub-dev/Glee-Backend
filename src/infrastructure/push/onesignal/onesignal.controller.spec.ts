import { Test, TestingModule } from '@nestjs/testing';
import { OnesignalController } from './onesignal.controller';
import { OnesignalService } from './onesignal.service';

describe('OnesignalController', () => {
  let controller: OnesignalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnesignalController],
      providers: [
        {
          provide: OnesignalService,
          useValue: {
            sendNotification: jest.fn(),
            addUserToNotificationList: jest.fn(),
            removeUserFromNotificationList: jest.fn(),
            markAllNotificationAsRead: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OnesignalController>(OnesignalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
