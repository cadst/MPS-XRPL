# Backend 기술 스택 & 개발환경 요약

프로젝트 백엔드는 NestJS(Typescript) 기반의 모듈화된 구조로 구성되며, 인증/음악/스케줄러/레코드 등 도메인별 모듈을 분리하여 유지보수성과 확장성을 확보했습니다. 아래는 핵심 기술 구성만을 간단히 정리한 문서입니다.

## 핵심 프레임워크 & 언어
- Node.js + TypeScript
- NestJS 11 (DI, 모듈 시스템, 데코레이터 기반 구조)

## 런타임 & 서버
- Express (NestJS 기본 HTTP 플랫폼)
- WebSocket (실시간 기능: `@nestjs/websockets`, `@nestjs/platform-socket.io`)
- Scheduling: `@nestjs/schedule` (Cron / Interval 작업)
- 정적 자산 제공: `@nestjs/serve-static`

## 인증 & 보안
- JWT 인증 (`@nestjs/jwt`, `passport`, `passport-jwt`)
- Local 전략 (`passport-local`)
- 비밀번호 해시: `bcryptjs`
- 쿠키 파싱: `cookie-parser`

## 데이터베이스 & ORM
- PostgreSQL (`pg`)
- Drizzle ORM (`drizzle-orm` + `drizzle-kit`): 타입 안전 쿼리 & 마이그레이션
  - 마이그레이션 스크립트: `drizzle/` 디렉토리
  - 설정: `drizzle.config.ts`
  - 명령:
    - 생성: `npm run db:generate`
    - 적용: `npm run db:migrate`
    - 스튜디오: `npm run db:studio`

## 캐시 / 성능
- Nest Cache Module (`@nestjs/cache-manager`)

## API 문서화
- Swagger (`@nestjs/swagger`)

## 유효성 & 직렬화
- `class-validator`, `class-transformer`

## 파일 업로드 & 자산
- Multer (`multer`) 기반 업로드
- 업로드 디렉토리: `uploads/` (images / music / lyrics / profile 등)

## 외부 연동 / 기타 라이브러리
- HTTP 클라이언트: `axios`
- 시간 처리: `dayjs`
- Web3 / 블록체인: `web3`, `ethers`
- OpenAI API: `openai`
- 환경 변수: `dotenv`

## 테스트
- 단위/통합: `jest`, `@nestjs/testing`
- E2E: `test/jest-e2e.json` 구성 (`npm run test:e2e`)
- 커버리지: `npm run test:cov`

## 빌드 & 개발 명령어
| 목적 | 명령어 |
|------|--------|
| 개발 서버 | `npm run start:dev` |
| 일반 실행 | `npm run start` |
| 프로덕션 빌드 | `npm run build` 후 `npm run start:prod` |
| 린트 & 포맷 | `npm run lint`, `npm run format` |
| 테스트 전체 | `npm run test` |
| E2E 테스트 | `npm run test:e2e` |
| 카테고리 시드 | `npm run seed:music-categories` |

## 코드 구조 (상위 레벨)
```
src/
  admin/        # 관리자용 모듈 (auth, dashboard, system 등)
  client/       # 클라이언트 기능 (auth, musics, playlists 등)
  music/        # 음악 처리 (가사, 메타, API Key 등)
  record/       # 이용 기록/로그 모듈
  scheduler/    # 정기 작업 (크론 등)
  common/       # 공용 유틸/공통 로직
  config/       # 환경/설정 (예: app.config.ts)
  db/           # DB 클라이언트, 스키마, 마이그레이션 연동
  scripts/      # 시드/배치 스크립트
```

## 환경 변수 (예시)
> 실제 키 값은 노출 금지. 아래는 형태 예시입니다.
```
DATABASE_URL=postgres://user:pass@host:5432/db
JWT_SECRET=...
OPENAI_API_KEY=...
PORT=3000
```

## 개발 흐름 요약
1. 환경 변수(.env) 설정
2. `npm install`
3. DB 마이그레이션 실행 (`npm run db:migrate`)
4. 필요 시 시드 스크립트 실행
5. 개발 서버 구동 (`npm run start:dev`)
6. Swagger 문서(앱 설정 시) 확인 후 기능 개발

## 품질 관리
- ESLint + Prettier 통합
- 타입 안정성: TypeScript + Drizzle 모델
- 테스트 자동화: Jest 스크립트

## 배포 기본 아이디어
- 빌드 산출물: `dist/`
- 실행: `node dist/main`
- 필요한 자산 폴더(`uploads`)는 퍼시스턴트 스토리지 마운트 권장

---
이 문서는 핵심 개요만을 다룹니다. 세부 구현/도메인 규칙은 각 모듈 내 주석 및 소스 코드 참고.
