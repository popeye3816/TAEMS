# CLAUDE.md — TAEMS (기술지원 통합관리 시스템)

이 파일은 Claude Code가 이 저장소에서 작업할 때 읽는 지침이다. 처음이면 **[docs/05_인수인계.md](docs/05_인수인계.md)를 먼저 읽는다.**

@AGENTS.md

## 사용자와 대화 규칙

- **모든 안내는 한국어로 쓴다.** 터미널·오류 메시지 등 영어 출력도 한국어로 번역해서 전달한다 (사용자 요청, 2026-10-15).
- 코드 주석·커밋 메시지·문서도 한국어. 기존 파일의 말투와 밀도를 따른다.
- 사용자: 이충호 (chlee@unipoint.co.kr, 관리자). 기술지원팀 업무 시스템을 직접 운영한다.

## 프로젝트

고객사별 점검기록·이슈·담당자·버전 정보를 모으고, 엔지니어 배정·월별 점검 일정을 관리하며, 처리 경험을 지식베이스로 쌓는 사내 시스템. 운영 주소 https://taems.vercel.app

- 요구사항 [PRD.md](PRD.md) · 설계 [docs/01_설계서.md](docs/01_설계서.md) · 운영 [docs/02_운영가이드.md](docs/02_운영가이드.md)
- 역할: 관리자(admin) / 엔지니어(engineer) / 영업(sales, 담당 고객사 결과서 다운로드만)

## 기술 스택과 명령

Next.js 16 (App Router, **cacheComponents 켜짐**, `proxy.ts`) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres·Auth·Storage, `@supabase/ssr`) · Vercel (서울 icn1, 매일 08:00 KST Cron)

```bash
npm run dev            # 로컬 개발 (localhost:3000, 운영 Supabase DB에 연결됨 — 주의)
npm run typecheck      # tsc
npm run lint
npm run build
npm run db:types       # DB 스키마 → src/lib/database.types.ts
npx supabase db push   # supabase/migrations/ 반영 (운영 DB)
npm run backup -- --files
```

배포: `main`에 push하면 Vercel이 자동 배포한다. 변경 후에는 typecheck·lint·build를 통과시키고 push한다.

## 구조

```
src/proxy.ts                    세션 갱신, 미로그인 → /login (/api/cron/은 제외)
src/lib/auth.ts                 getCurrentUser(cache), requireRole — 모든 페이지·액션의 권한 확인
src/lib/roles.ts                역할, 메뉴(NAV_ITEMS), 경로별 권한 — 메뉴 추가 시 여기부터
src/lib/supabase/               server(RLS) / admin(service_role, 권한 확인 후에만) / client(브라우저 업로드) / proxy
src/lib/crypto.ts               IP·계정 AES-256-GCM (ENCRYPTION_KEY). scripts/import/load.mjs에도 같은 형식
src/lib/notify.ts, events.ts    알림 (시스템 + 메일 Resend + 카카오워크 + Slack, 키 없으면 skipped 기록)
src/lib/format.ts               한국 시간 표시·todayKst·requestTime
src/app/(app)/                  로그인 후 화면: customers, schedule, reports, issues, kb, workload, admin/users, notifications, account
src/app/api/files/[kind]/[id]   파일 다운로드 (RLS로 행 조회 성공 시 60초 서명 URL)
src/app/api/cron/daily          정기 알림 (CRON_SECRET)
supabase/migrations/            DB 스키마·RLS의 유일한 출처
scripts/import/                 기존 엑셀·문서 가져오기 (.import/ 결과물은 git 제외)
```

## 반드시 지킬 것 (실제로 문제가 났던 것들)

- **Next 16**: 세션(cookies)을 읽는 컴포넌트는 반드시 `<Suspense>` 안에서. 페이지 패턴: 동기 page → `<Suspense>` → async 내부 컴포넌트에서 `requireRole(...)`. 렌더 중 `Date.now()` 금지(린트 오류) → `requestTime()`. 서버 액션 후 갱신은 `refresh()`(next/cache). 알림처럼 응답 후 할 일은 `after()`.
- **권한은 두 겹**: 화면/액션에서 `requireRole`, DB에서 RLS. 새 테이블은 RLS 켜고 정책을 마이그레이션에 함께 쓴다. `createAdminClient()`는 RLS를 우회하므로 호출자 권한 확인 뒤에만.
- **시간대**: 서버·DB는 UTC. 화면 표시는 `formatDateTime`, 오늘 날짜는 `todayKst()`, datetime-local 입력은 `kstInputToIso()`. `toISOString().slice(0,10)` 금지.
- **파일 업로드**: Vercel은 4.5MB 넘는 요청을 못 받으므로 브라우저 → Storage 직접 업로드(서명 업로드 URL, `prepareUpload` → `uploadToSignedUrl` → confirm 액션). Storage 경로에 한글 금지(uuid 사용), 원래 이름은 DB에.
- **Supabase 인증 설정**: `supabase/config.toml`의 `[auth.email].enable_signup`은 **이메일 로그인 자체를 켜는 스위치**다. false로 하면 전원 로그인 불가(2026-10-15 사고). 회원가입 차단은 `[auth].enable_signup = false`. `config push` 전에 diff를 확인한다.
- **비밀값**: `.env.local`, `.secrets/`, `.import/`, `backups/`는 git 제외. 커밋 전 `git diff --cached`에 키·실제 고객 전화번호가 없는지 확인한다. `ENCRYPTION_KEY`는 바꾸면 기존 암호문을 못 읽는다.
- **사용자 계정으로 로그인하지 않는다**: Claude는 실제 계정 비밀번호를 입력해 로그인하지 않는다. 로그인 후 화면은 사용자에게 확인을 요청하고, 서버 로직은 service_role 스크립트로 검증한다(테스트 데이터는 지운다).
- **고객 데이터**: 지식베이스·문서에 고객 IP·연락처를 넣지 않는다(가져오기 시 마스킹). 접속정보는 고객사 화면의 암호화 필드로만.

## 결정된 사항 (다시 묻지 말 것)

- 점검결과서는 **항목 입력 없이 파일(PDF·doc·한글·사진) 업로드/다운로드만** (체크리스트 테이블 삭제됨)
- 메신저는 카카오워크(개인)와 Slack(팀 채널) 둘 다
- MA 시트 영업대표는 2번째 열만 사용
- 이슈 지연 기준(기본값): 미배정 4시간, 긴급 1일·높음 3일·보통 7일·낮음 14일 — `src/lib/issue-fields.ts`
- 접속정보(IP·계정·비밀번호)는 암호화해서 저장, 관리자·현재 담당 엔지니어만 열람, 열람 기록
