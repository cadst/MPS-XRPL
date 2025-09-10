import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe, ParseIntPipe } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { RewardsSummaryQueryDto } from './dto/rewards-summary.query.dto';
import { RewardsDetailQueryDto } from './dto/rewards-detail.query.dto';
import { CompanyTotalStatsQueryDto } from './dto/company-stats.dto';
import { RenewalStatsQueryDto } from './dto/renewal-stats.dto';
import { HourlyPlaysQueryDto } from './dto/hourly-plays.dto';
import { TierDistributionQueryDto } from './dto/tier-distribution.dto';
import { RevenueCalendarQueryDto } from './dto/revenue-calendar.dto';
import { RevenueTrendsQueryDto } from './dto/revenue-trends.dto';
import { RevenueCompaniesQueryDto } from './dto/revenue-companies.dto';

@Controller('/admin/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companyService.create(createCompanyDto);
  }

  @Get()
  findAll() {
    return this.companyService.findAll();
  }

  @Get('rewards/summary')
  async getRewardsSummary(
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: RewardsSummaryQueryDto,
  ) {
    return this.companyService.getRewardsSummary(query);
  }

  @Get('stats/total')
  async getCompanyTotal(@Query(new ValidationPipe({ transform: true })) query: CompanyTotalStatsQueryDto) {
    return this.companyService.getTotalCount(query)
  }

  @Get('stats/renewal')
  async getRenewalStats(@Query(new ValidationPipe({ transform: true })) query: RenewalStatsQueryDto) {
    return this.companyService.getRenewalStats(query)
  }

  @Get('stats/hourly-plays')
  async getHourlyPlays(@Query(new ValidationPipe({ transform: true })) query: HourlyPlaysQueryDto) {
    return this.companyService.getHourlyValidPlays(query)
  }

  @Get('stats/tier-distribution')
  async getTierDistribution(@Query(new ValidationPipe({ transform: true })) query: TierDistributionQueryDto) {
    return this.companyService.getTierDistribution(query)
  }

  @Get('revenue/calendar')
  async getRevenueCalendar(@Query(new ValidationPipe({ transform: true })) query: RevenueCalendarQueryDto) {
    return this.companyService.getRevenueCalendar(query);
  }

  @Get('revenue/trends')
  async getRevenueTrends(@Query(new ValidationPipe({ transform: true })) query: RevenueTrendsQueryDto) {
    return this.companyService.getRevenueTrends(query);
  }

  @Get('revenue/companies')
  async getRevenueCompanies(@Query(new ValidationPipe({ transform: true })) query: RevenueCompaniesQueryDto) {
    return this.companyService.getRevenueCompanies(query);
  }

  @Get(':id/rewards/detail')
  async getRewardsDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: RewardsDetailQueryDto,
  ) {
    return this.companyService.getRewardsDetail(id, query.yearMonth);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companyService.update(+id, updateCompanyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyService.remove(+id);
  }

}
