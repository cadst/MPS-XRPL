import { Test, TestingModule } from '@nestjs/testing';
import { CompanieService } from './companies.service';

describe('CompanieService', () => {
  let service: CompanieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanieService],
    }).compile();

    service = module.get<CompanieService>(CompanieService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
