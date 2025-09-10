import { Controller, Get, Query } from '@nestjs/common'
import { SystemService } from './system.service'
import { SystemStatsDto, SystemChartDto, SystemKeysDto } from './dto/system.dto'

@Controller('admin/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('api/stats')
  async getApiStats(@Query() query: SystemStatsDto) {
    return this.systemService.getApiStats(query)
  }

  @Get('api/chart')
  async getApiChart(@Query() query: SystemChartDto) {
    return this.systemService.getApiChart(query)
  }

  @Get('api/keys')
  async getApiKeys(@Query() query: SystemKeysDto) {
    return this.systemService.getApiKeys(query)
  }
}
