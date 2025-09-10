import { Test, TestingModule } from '@nestjs/testing';
import { MeGateway } from './me.gateway';
import { MeService } from './me.service';

describe('MeGateway', () => {
  let gateway: MeGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeGateway, MeService],
    }).compile();

    gateway = module.get<MeGateway>(MeGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
