import { Test, TestingModule } from '@nestjs/testing';
import { CompanieController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompanieController', () => {
  let controller: CompanieController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanieController],
      providers: [CompaniesService],
    }).compile();

    controller = module.get<CompanieController>(CompanieController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
