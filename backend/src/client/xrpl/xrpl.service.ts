import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Wallet, Payment } from 'xrpl';

@Injectable()
export class XrplService {
  private readonly logger = new Logger(XrplService.name);
  private client!: Client;
  private readonly endpoint: string;
  private readonly adminSeed?: string;

  constructor(private readonly config: ConfigService) {
    // 기본은 Devnet. 필요시 .env XRPL_WS_URL 로 변경
    this.endpoint =
      this.config.get<string>('XRPL_WS_URL') ||
      'wss://s.devnet.rippletest.net:51233';
    this.adminSeed = this.config.get<string>('XRPL_ADMIN_SEED');
  }

  private async getClient() {
    if (!this.client) {
      this.client = new Client(this.endpoint);
      await this.client.connect();
    } else if (!this.client.isConnected()) {
      await this.client.connect();
    }
    return this.client;
  }

  async generateWallet(): Promise<{ address: string; seed: string }> {
    const wallet = Wallet.generate();
    return { address: wallet.address, seed: wallet.seed! };
  }

  async fundTestnetWalletIfPossible(address: string) {
    this.logger.log(
      `XRPL devnet 지갑(${address}) 초기 자금 주입이 필요할 수 있습니다. (개발용 팁: https://xrpl.org/resources/dev-tools/xrp-faucets/)`,
    );
  }

  // 리워드 → XRP 전환 전송
  async sendXrp(params: { destination: string; amountXrp: string }) {
    if (!this.adminSeed)
      throw new Error('XRPL_ADMIN_SEED가 설정되어 있지 않습니다.');
    const client = await this.getClient();
    try {
      const admin = Wallet.fromSeed(this.adminSeed.trim());
      const tx: Payment = {
        TransactionType: 'Payment',
        Account: admin.address,
        Destination: params.destination,
        Amount: String(Math.round(Number(params.amountXrp) * 1_000_000)), // drops
      };
      const prepared = await client.autofill(tx);
      const signed = admin.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);
      const hash =
        (result as any)?.result?.hash || (result as any)?.tx_json?.hash;
      this.logger.log(`XRPL Payment 성공 tx=${hash}`);
      return { hash, result };
    } finally {
      // 연결은 재사용
    }
  }

  async disconnect() {
    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
    }
  }
}
