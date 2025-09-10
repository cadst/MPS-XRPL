import { Module } from '@nestjs/common';
import { MusicsService } from './musics.service';
import { MusicsController } from './musics.controller';
import {DbModule} from '../../db/db.module'

@Module({
  imports:[DbModule],
  controllers: [MusicsController],
  providers: [MusicsService],
})
export class MusicsModule {}
