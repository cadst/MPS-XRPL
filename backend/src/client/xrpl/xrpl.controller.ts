import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { XrplService } from './xrpl.service';
import { CompaniesRepository } from '../companies/companies.repository';

@UseGuards(JwtAuthGuard)
@Controller('xrpl')
export class XrplController {
  constructor(
    private readonly xrpl: XrplService,
    private readonly repo: CompaniesRepository,
  ) {}

  @Post('wallet')
  async createWallet(@Req() req: any) {
    const companyId = Number(req.user.sub);
    const { address, seed } = await this.xrpl.generateWallet();
    await this.repo.updateXrplAddress(companyId, address);
    return { address, seed };
  }
}
