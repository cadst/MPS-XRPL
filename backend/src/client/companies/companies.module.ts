import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { OdcloudClient } from './odcloud.client';
import { BlockchainService } from './blockchain.service';
import { UtilsModule } from '../common/utils/utils.module';
import { XrplService } from '../xrpl/xrpl.service';
@Module({
  imports: [UtilsModule],
  controllers: [CompaniesController],
  providers: [
    CompaniesRepository,
    CompaniesService,
    OdcloudClient,
    BlockchainService,
    XrplService,
  ],
  exports: [
    CompaniesRepository,
    CompaniesService,
    BlockchainService,
    XrplService,
  ],
})
export class CompanieModule {}
