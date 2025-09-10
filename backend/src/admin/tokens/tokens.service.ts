import { Injectable } from '@nestjs/common'
import { TokenInfoDto, WalletInfoDto, DailyBatchesDto, BatchDetailDto, TransactionsDto, TransactionDetailDto } from './dto/tokens.dto'
import { Web3Service } from './web3.service'
import { TokensQueries } from './queries/tokens.queries'
import { db } from '../../db/client'

@Injectable()
export class TokensService {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly tokensQueries: TokensQueries
  ) {}

  async getTokenInfo() {
    try {
      // 온체인에서 토큰 정보 조회
      const onchainInfo = await this.web3Service.getTokenInfo()
      
      // DB에서 총 발행량 계산 (companies.total_rewards_earned 합계)
      const totalIssued = await this.tokensQueries.getTotalIssuedTokens()
      
      // DB에서 소각량 계산 (rewards 테이블에서 소각된 토큰)
      const totalBurned = await this.tokensQueries.getTotalBurnedTokens()
      
      return {
        contractAddress: process.env.REWARD_TOKEN_CONTRACT_ADDRESS,
        totalSupply: onchainInfo.totalSupply,
        totalIssued: totalIssued,
        totalBurned: totalBurned,
        circulatingSupply: totalIssued - totalBurned,
        tokenName: onchainInfo.name,
        tokenSymbol: onchainInfo.symbol,
        decimals: onchainInfo.decimals
      }
    } catch (error) {
      console.error('토큰 정보 조회 실패:', error)
      throw new Error('토큰 정보를 가져올 수 없습니다')
    }
  }

  async getWalletInfo() {
    try {
      const walletAddress = process.env.WALLET_ADDRESS
      if (!walletAddress) {
        throw new Error('WALLET_ADDRESS 환경 변수가 설정되지 않았습니다')
      }
      const ethBalance = await this.web3Service.getEthBalance(walletAddress)
      
      return {
        address: walletAddress,
        ethBalance: ethBalance,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('지갑 정보 조회 실패:', error)
      throw new Error('지갑 정보를 가져올 수 없습니다')
    }
  }

  async getDailyBatches(dto: DailyBatchesDto) {
    try {
      const limit = parseInt(dto.limit || '10')
      const offset = parseInt(dto.offset || '0')
      
      return await this.tokensQueries.getDailyBatches(limit, offset)
    } catch (error) {
      console.error('일별 배치 조회 실패:', error)
      throw new Error('일별 배치 데이터를 가져올 수 없습니다')
    }
  }

  async getBatchDetail(dto: BatchDetailDto) {
    try {
      const batch = await this.tokensQueries.getBatchDetail(dto.date)
      if (!batch) {
        throw new Error('해당 날짜의 배치 데이터를 찾을 수 없습니다')
      }
      
      // 기업별 리워드 분배 데이터
      const companyDistributions = await this.tokensQueries.getCompanyDistributions(dto.date)
      
      // 유효재생 히스토리
      const validPlayHistory = await this.tokensQueries.getValidPlayHistory(dto.date)
      
      return {
        ...batch,
        companyDistributions,
        validPlayHistory
      }
    } catch (error) {
      console.error('배치 상세 조회 실패:', error)
      throw new Error('배치 상세 데이터를 가져올 수 없습니다')
    }
  }

  async getTransactions(dto: TransactionsDto) {
    try {
      const limit = parseInt(dto.limit || '20')
      const offset = parseInt(dto.offset || '0')
      
      return await this.tokensQueries.getTransactions(limit, offset)
    } catch (error) {
      console.error('트랜잭션 조회 실패:', error)
      throw new Error('트랜잭션 데이터를 가져올 수 없습니다')
    }
  }

  async getTransactionDetail(id: string) {
    try {
      return await this.tokensQueries.getTransactionDetail(id)
    } catch (error) {
      console.error('트랜잭션 상세 조회 실패:', error)
      throw new Error('트랜잭션 상세 데이터를 가져올 수 없습니다')
    }
  }
}
