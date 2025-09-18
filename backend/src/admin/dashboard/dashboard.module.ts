import { Module } from '@nestjs/common'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeService } from './realtime.service'

@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeGateway, RealtimeService]
})
export class DashboardModule {}