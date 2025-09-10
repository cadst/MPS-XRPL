import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { OdcloudClient } from './odcloud.client';
import { BlockchainService } from './blockchain.service';
import { UtilsModule } from '../common/utils/utils.module';
@Module({
  imports: [UtilsModule],
  controllers: [CompaniesController],
  providers: [CompaniesRepository, CompaniesService, OdcloudClient, BlockchainService],
  exports: [CompaniesRepository, CompaniesService, BlockchainService],
})
export class CompanieModule {}
