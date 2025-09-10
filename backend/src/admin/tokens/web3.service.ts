import { Injectable } from '@nestjs/common'
import Web3 from 'web3'

@Injectable()
export class Web3Service {
  private web3: Web3
  private rewardTokenContract: any
  private recordUsageContract: any

  constructor() {
    // Sepolia 테스트넷 연결
    this.web3 = new Web3(process.env.INFURA_RPC)
    
    // ERC20 토큰 컨트랙트 ABI (기본적인 메서드들)
    const erc20Abi = [
      {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
      }
    ]

    // 컨트랙트 인스턴스 생성
    this.rewardTokenContract = new this.web3.eth.Contract(
      erc20Abi,
      process.env.REWARD_TOKEN_CONTRACT_ADDRESS
    )
  }

  async getTokenInfo() {
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.rewardTokenContract.methods.name().call(),
        this.rewardTokenContract.methods.symbol().call(),
        this.rewardTokenContract.methods.decimals().call(),
        this.rewardTokenContract.methods.totalSupply().call()
      ])

      return {
        name,
        symbol,
        decimals: parseInt(decimals),
        totalSupply: this.web3.utils.fromWei(totalSupply, 'ether')
      }
    } catch (error) {
      console.error('토큰 정보 조회 실패:', error)
      throw error
    }
  }

  async getEthBalance(address: string): Promise<number> {
    try {
      const balance = await this.web3.eth.getBalance(address)
      return parseFloat(this.web3.utils.fromWei(balance, 'ether'))
    } catch (error) {
      console.error('ETH 잔액 조회 실패:', error)
      throw error
    }
  }

  async getTokenBalance(address: string): Promise<number> {
    try {
      const balance = await this.rewardTokenContract.methods.balanceOf(address).call()
      return parseFloat(this.web3.utils.fromWei(balance, 'ether'))
    } catch (error) {
      console.error('토큰 잔액 조회 실패:', error)
      throw error
    }
  }

  // 특정 날짜의 온체인 이벤트 조회 (Transfer 이벤트)
  async getTransferEvents(fromBlock: number, toBlock: number) {
    try {
      const transferEventSignature = this.web3.utils.keccak256('Transfer(address,address,uint256)')
      
      const events = await this.web3.eth.getPastLogs({
        address: process.env.REWARD_TOKEN_CONTRACT_ADDRESS,
        topics: [transferEventSignature],
        fromBlock,
        toBlock
      })

      return events.map((event: any) => ({
        transactionHash: event.transactionHash || '',
        blockNumber: event.blockNumber || 0,
        from: '0x' + (event.topics?.[1] || '').slice(26),
        to: '0x' + (event.topics?.[2] || '').slice(26),
        value: this.web3.utils.fromWei(event.data || '0', 'ether')
      }))
    } catch (error) {
      console.error('Transfer 이벤트 조회 실패:', error)
      throw error
    }
  }

  // 특정 날짜의 블록 범위 조회
  async getBlockRangeForDate(date: string) {
    try {
      const startOfDay = new Date(date + 'T00:00:00Z')
      const endOfDay = new Date(date + 'T23:59:59Z')
      
      // 대략적인 블록 번호 계산 (Sepolia는 약 12초마다 블록 생성)
      const currentBlock = await this.web3.eth.getBlockNumber()
      const currentTime = Math.floor(Date.now() / 1000)
      const blockTime = 12 // Sepolia 블록 시간 (초)
      
      const timeDiff = currentTime - Math.floor(startOfDay.getTime() / 1000)
      const blockDiff = Math.floor(timeDiff / blockTime)
      
      const fromBlock = Math.max(0, Number(currentBlock) - blockDiff - 100) // 여유분 추가
      const toBlock = Number(currentBlock) - blockDiff + 100
      
      return { fromBlock, toBlock }
    } catch (error) {
      console.error('블록 범위 조회 실패:', error)
      throw error
    }
  }
}
