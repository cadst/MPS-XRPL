import { Module } from '@nestjs/common'
import { TokensController } from './tokens.controller'
import { TokensService } from './tokens.service'
import { Web3Service } from './web3.service'
import { TokensQueries } from './queries/tokens.queries'

@Module({
  controllers: [TokensController],
  providers: [TokensService, Web3Service, TokensQueries],
  exports: [TokensService]
})
export class TokensModule {}
