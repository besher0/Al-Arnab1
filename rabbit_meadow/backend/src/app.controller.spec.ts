import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return health payload', () => {
    const result = appController.health();
    expect(result.ok).toBe(true);
    expect(result.service).toBe('al-arnab-backend');
  });
});
