# MPS (Music Platform Service) with XRP Ledger Integration

이 문서는 MPS 프로젝트에 XRP Ledger (XRPL)를 통합하여 구현한 기능과 기술적인 내용을 설명합니다. 사용자 리워드 시스템에 블록체인 기술을 도입하여 투명성을 높이고, 새로운 가치 교환의 가능성을 제공하는 것을 목표로 합니다.

## 🚀 XRPL 통합 개요

MPS는 사용자의 활동(예: 음원 스트리밍, 창작)에 대한 보상으로 지급되는 리워드를 XRP Ledger의 네이티브 토큰인 XRP로 전환할 수 있는 기능을 제공합니다. 이를 위해 다음과 같은 핵심 기능을 구현했습니다.

1.  **회원가입 시 XRPL 지갑 자동 생성**: 사용자는 별도의 복잡한 절차 없이 회원가입만으로 자신만의 XRPL 지갑을 소유하게 됩니다.
2.  **리워드의 XRP 전환**: 사용자는 자신이 보유한 서비스 내 리워드를 원하는 시점에 XRP로 전환하여 외부 XRPL 생태계에서 활용할 수 있습니다.

![XRPL Integration Flow](https://via.placeholder.com/800x250.png?text=MPS+User+Reward+to+XRP+Conversion+Flow)
> *이미지: 회원가입 → XRPL 지갑 생성 → 리워드 활동 → XRP 전환 요청 → XRPL 네트워크 전송 흐름도*

## ✨ 주요 기능 및 흐름

MPS에 적용된 XRPL 기능은 `backend/src/client/xrpl` 폴더에서 확인할 수 있습니다.


### 1. XRPL 지갑 생성 (Wallet Creation)

```js
async generateWallet(): Promise<{ address: string; seed: string }> {
    const wallet = Wallet.generate();
    return { address: wallet.address, seed: wallet.seed! };
  }
```

<img width="1424" height="661" alt="스크린샷 2025-09-20 오후 4 29 26" src="https://github.com/user-attachments/assets/3151d545-2021-4410-820a-d3b2eeebffbd" />

- **자동 생성**: 사용자가 서비스에 **회원가입**을 완료하면, 서버는 자동으로 해당 사용자를 위한 고유한 XRPL 지갑(주소 및 시드)을 생성합니다.
- **데이터베이스 저장**: 생성된 지갑 주소(`address`)는 사용자의 정보와 함께 데이터베이스(`companies.xrpl_address`)에 안전하게 저장됩니다.
- **시드 키 1회 노출**: 보안을 위해, 지갑의 소유권을 증명하는 **시드(`seed`)는 회원가입 직후 응답으로 단 한 번만 사용자에게 노출**됩니다. 서버는 시드 값을 저장하지 않으므로, 사용자는 이를 반드시 안전한 곳에 별도로 보관해야 합니다.

### 2. 리워드 → XRP 전환 (Reward to XRP Conversion)

```js
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
      const validated = !!(result as any)?.result?.validated_ledger_index;
      this.logger.log(`XRPL Payment 성공 tx=${hash}`);
      return { hash, validated, result };
    } finally {
      // 연결은 재사용
    }
  }
```

<img width="1412" height="667" alt="스크린샷 2025-09-20 오후 5 09 10" src="https://github.com/user-attachments/assets/3bfd2adc-b436-4fd6-97f9-5dc97496b41b" />

<img width="1102" height="596" alt="스크린샷 2025-09-20 오후 5 09 26" src="https://github.com/user-attachments/assets/00e013a3-5be7-4781-8b21-09f1bb8ebf77" />


- **전환 요청 API**: 사용자는 보유한 리워드를 XRP로 전환하기 위해 `POST /me/rewards/convert` 엔드포인트를 통해 요청을 보냅니다.
  - **입력값**: `{ amount: number, destination?: string }`
    - `amount`: XRP로 전환할 리워드의 양입니다.
    - `destination` (선택 사항): 전환된 XRP를 받을 외부 XRPL 주소입니다. 지정하지 않을 경우, 회원가입 시 생성된 사용자의 기본 지갑으로 전송됩니다.
- **전환 프로세스**:
  1. 서버는 사용자의 리워드 잔액을 확인하고 요청된 `amount`만큼 차감합니다.
  2. XRPL의 **Payment 트랜잭션**을 생성하여 사용자 지갑으로 XRP를 전송합니다.
  3. 트랜잭션이 성공적으로 처리되면, 해당 거래의 고유 식별자인 **트랜잭션 해시(tx hash)**를 사용자에게 반환합니다. 이를 통해 모든 전환 내역은 XRPL 상에서 투명하게 조회 가능합니다.
- **전환 비율**: 현재 기본 전환 비율은 **1 리워드 = 1 XRP**로 설정되어 있습니다. 이 비율은 추후 운영 정책에 따라 변경될 수 있습니다.

## 🛠️ 기술 구현 상세 (Technical Implementation)

### Backend

- **데이터베이스 스키마**:
  - `companies` 테이블에 `xrpl_address` (VARCHAR) 컬럼을 추가하여 사용자의 XRPL 지갑 주소를 저장합니다.
  - 마이그레이션 파일: `backend/drizzle/0005_add_xrpl_address.sql`

- **주요 API 엔드포인트**:
  - `companies.register`: 회원가입 처리 로직 내부에 XRPL 지갑 생성 및 `xrpl_address` 저장 로직을 포함합니다.
  - `POST /me/rewards/convert`: 리워드 차감 및 XRPL Payment 트랜잭션 전송을 처리합니다.
  - `GET /me/overview`: 사용자의 기본 정보를 조회하는 API 응답에 `xrpl_address` 필드를 포함하여 프론트엔드에서 지갑 주소를 확인할 수 있도록 합니다.

- **보조 API**:
  - `POST /xrpl/wallet`: 이미 가입한 사용자가 지갑을 다시 생성해야 하거나, 테스트 목적으로 수동 생성이 필요할 경우를 대비한 엔드포인트입니다.

### Frontend (Client)

- **UI/UX 변경사항** (`page.tsx`):
  - 사용자 정보 페이지에 생성된 **XRPL 지갑 주소를 표시**합니다.
  - 지갑이 없는 사용자를 위해 **"XRPL 지갑 생성" 버튼**을 추가했습니다. (수동 생성용)
  - **"리워드 → XRP 전환" 폼**을 구현하여, 사용자가 전환할 리워드 양과 목적지 주소를 입력할 수 있도록 했습니다.

- **API 연동** (`me.ts`):
  - `fetchMeOverview`: 기존 API 어댑터에 `xrplAddress` 필드를 반영하여 상태를 관리합니다.
  - `createXrplWallet()`: "XRPL 지갑 생성" 버튼과 연결되는 API 요청 함수입니다.
  - `convertRewards()`: "리워드 → XRP 전환" 폼 제출 시 호출되는 API 요청 함수입니다.
