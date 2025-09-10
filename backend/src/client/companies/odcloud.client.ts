import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OdcloudClient {
  constructor(private readonly config: ConfigService) {}

  private qs() {
    const p = new URLSearchParams({
      serviceKey: this.config.get<string>('odcloud.keyEnc')!,
      returnType: this.config.get<string>('odcloud.returnType') ?? 'JSON',
    });
    return `?${p.toString()}`;
  }

  async status(bNo: string) {
    const base = this.config.get<string>('odcloud.baseUrl')!;
    const res = await fetch(`${base}/nts-businessman/v1/status${this.qs()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ b_no: [bNo] }),
    });
    if (!res.ok) throw new HttpException('ODcloud status error', res.status);
    return res.json();
  }
}
