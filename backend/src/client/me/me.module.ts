import { Module } from '@nestjs/common';
import { MeService } from './me.service';
import { DbModule } from '../../db/db.module';
import { MeController } from './me.controller';
import { MeRepo } from './data/me.repo';
import { XrplService } from '../xrpl/xrpl.service';

@Module({
  imports: [DbModule],
  controllers: [MeController],
  providers: [MeService, XrplService],
})
export class MeModule {}
