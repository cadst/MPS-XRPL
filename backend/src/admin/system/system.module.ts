import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'
import { SystemService } from './system.service'
import { DbModule } from '../../db/db.module'

@Module({
  imports: [DbModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
