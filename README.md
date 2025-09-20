# MPS (Music Platform Service) with XRP Ledger Integration

이 문서는 MPS 프로젝트에 XRP Ledger (XRPL)를 통합하여 구현한 기능과 기술적인 내용을 설명합니다. 사용자 리워드 시스템에 블록체인 기술을 도입하여 투명성을 높이고, 새로운 가치 교환의 가능성을 제공하는 것을 목표로 합니다.

## 🚀 XRPL 통합 개요

MPS는 사용자의 활동(예: 음원 스트리밍, 창작)에 대한 보상으로 지급되는 리워드를 XRP Ledger의 네이티브 토큰인 XRP로 전환할 수 있는 기능을 제공합니다. 이를 위해 다음과 같은 핵심 기능을 구현했습니다.

1.  **회원가입 시 XRPL 지갑 자동 생성**: 사용자는 별도의 복잡한 절차 없이 회원가입만으로 자신만의 XRPL 지갑을 소유하게 됩니다.
2.  **리워드의 XRP 전환**: 사용자는 자신이 보유한 서비스 내 리워드를 원하는 시점에 XRP로 전환하여 외부 XRPL 생태계에서 활용할 수 있습니다.

![XRPL Integration Flow](https://via.placeholder.com/800x250.png?text=MPS+User+Reward+to+XRP+Conversion+Flow)
> *이미지: 회원가입 → XRPL 지갑 생성 → 리워드 활동 → XRP 전환 요청 → XRPL 네트워크 전송 흐름도*

## ✨ 주요 기능 및 흐름

### 1. XRPL 지갑 생성 (Wallet Creation)

- **자동 생성**: 사용자가 서비스에 **회원가입**을 완료하면, 서버는 자동으로 해당 사용자를 위한 고유한 XRPL 지갑(주소 및 시드)을 생성합니다.
- **데이터베이스 저장**: 생성된 지갑 주소(`address`)는 사용자의 정보와 함께 데이터베이스(`companies.xrpl_address`)에 안전하게 저장됩니다.
- **시드 키 1회 노출**: 보안을 위해, 지갑의 소유권을 증명하는 **시드(`seed`)는 회원가입 직후 응답으로 단 한 번만 사용자에게 노출**됩니다. 서버는 시드 값을 저장하지 않으므로, 사용자는 이를 반드시 안전한 곳에 별도로 보관해야 합니다.

### 2. 리워드 → XRP 전환 (Reward to XRP Conversion)

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

 ## 🔑 환경변수 설정 가이드 (.env)

이 프로젝트를 실행하기 위해서는 각 환경에 맞는 `.env` 파일 설정이 필요합니다. `.env` 파일은 민감한 정보를 코드로부터 분리하여 안전하게 관리하기 위해 사용됩니다. **주의: `.env` 파일은 절대로 Git과 같은 버전 관리 시스템에 포함시키면 안 됩니다.**

### 1. Admin Frontend

관리자 페이지 프론트엔드 설정입니다.

- **위치**: `frontend/admin/.env`
- **내용**:

```env
# 백엔드 API 서버의 전체 주소
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### 2. Client Frontend

일반 사용자용 프론트엔드 설정입니다. `.env.local` 파일을 생성하여 아래 내용을 작성합니다.

- **위치**: `frontend/client/.env.local`
- **내용**:

```env
# 연결할 백엔드 API 서버의 전체 주소
# 예: [https://api.your-domain.com](https://api.your-domain.com)
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

### 3. Backend

백엔드 서버 설정입니다. 가장 민감한 정보들을 포함하고 있으므로, 실제 배포 시에는 반드시 모든 <...> 값을 실제 운영 환경에 맞게 안전하게 변경해야 합니다.

- **위치**: `backend/.env`
- **내용**:

```env
# ---------------------------------
# 기본 서버 설정 (필수)
# ---------------------------------
# 실제 운영 환경의 데이터베이스 연결 주소
DATABASE_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>
# 서버가 실행될 포트 번호
PORT=4000
# 실행 환경 (development | production)
NODE_ENV=production
# Admin 클라이언트의 배포 주소 (CORS 등에서 사용)
FRONTEND_URL=https://<ADMIN_CLIENT_DOMAIN>

# ---------------------------------
# JWT (JSON Web Token) 설정 (필수)
# ---------------------------------
# 토큰 서명에 사용할 비밀 키 (매우 길고 무작위적인 문자열로 교체)
JWT_SECRET=<GENERATE_A_VERY_LONG_AND_RANDOM_SECRET_HERE>
JWT_ISS=mps
JWT_AUD=mps-client
# 토큰 만료 시간
JWT_EXPIRES_IN=1h

# ---------------------------------
# 관리자 계정 설정 (필수)
# ---------------------------------
ADMIN_ID=<SET_YOUR_ADMIN_ID>
ADMIN_PW=<SET_A_STRONG_ADMIN_PASSWORD>

# ---------------------------------
# API 키 설정 (필수)
# ---------------------------------
# API 키 암호화에 사용할 salt 값 (무작위 문자열)
API_KEY_PEPPER=<GENERATE_A_STRONG_RANDOM_STRING_FOR_PEPPER>
API_KEY_PREFIX=sk_live
API_KEY_VERSION=1

# ---------------------------------
# 파일 업로드 경로 설정
# ---------------------------------
MUSIC_BASE_DIR=uploads/music
LYRICS_BASE_DIR=uploads/lyrics

# ---------------------------------
# 블록체인 및 컨트랙트 설정 (필수)
# ---------------------------------
# Sepolia 테스트넷 Infura RPC 엔드포인트
INFURA_RPC=[https://sepolia.infura.io/v3/](https://sepolia.infura.io/v3/)<YOUR_INFURA_PROJECT_ID>
# 트랜잭션 서명에 사용할 서버 지갑의 개인 키 (절대 외부에 노출 금지!)
PRIVATE_KEY=<YOUR_SERVER_WALLET_PRIVATE_KEY>
# 서버 지갑 주소
WALLET_ADDRESS=<YOUR_SERVER_WALLET_ADDRESS>

# 배포된 스마트 컨트랙트 주소
EntryPoint=<YOUR_ENTRYPOINT_CONTRACT_ADDRESS>
Paymaster=<YOUR_PAYMASTER_CONTRACT_ADDRESS>
SmartAccountFactory=<YOUR_SMARTACCOUNTFACTORY_CONTRACT_ADDRESS>
RewardToken=<YOUR_REWARDTOKEN_CONTRACT_ADDRESS>
RecordUsage=<YOUR_RECORDUSAGE_CONTRACT_ADDRESS>
REWARD_TOKEN_CONTRACT_ADDRESS=<YOUR_REWARD_TOKEN_CONTRACT_ADDRESS>
RECORD_USAGE_CONTRACT_ADDRESS=<YOUR_RECORD_USAGE_CONTRACT_ADDRESS>


# ---------------------------------
# 외부 API 설정 (선택/필요시)
# ---------------------------------
# 사업자등록번호 진위확인 API 종류
BIZNO_VERIFIER=HYBRID

# ODCloud 국세청 API
ODCLOUD_BASE_URL=[https://api.odcloud.kr/api](https://api.odcloud.kr/api)
ODCLOUD_SERVICE_KEY=<YOUR_ODCLOUD_API_SERVICE_KEY>
ODCLOUD_SERVICE_KEY_ENC=<YOUR_ODCLOUD_ENCODED_SERVICE_KEY>
ODCLOUD_RETURN_TYPE=JSON

# OpenAI API
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>

# ---------------------------------
# 기타 설정
# ---------------------------------
TAGS_AUTO_NORMALIZE=1
TAGS_NORMALIZE_LIMIT=100
```
