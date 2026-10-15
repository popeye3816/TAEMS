# TAEMS — 기술지원 통합관리 시스템

고객사별 점검기록·이슈·담당자·버전 정보를 한곳에 모으고, 엔지니어 배정과 월별 기술지원 일정을 관리하며, 처리 경험을 지식으로 축적하는 사내 시스템.

- 요구사항: [PRD.md](PRD.md)
- 설계: [docs/01_설계서.md](docs/01_설계서.md)

## 구성

| 구분 | 서비스 | 계정 |
|---|---|---|
| 소스 | GitHub `taems` 저장소 | chlee@unipoint.co.kr |
| 호스팅 | Vercel | chlee@unipoint.co.kr |
| DB·인증·파일 | Supabase | chlee@unipoint.co.kr |

기술 스택: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (`@supabase/ssr`)

## 처음 설정하기

### 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (Region: **Northeast Asia (Seoul)** 권장)
2. **SQL Editor**에 `supabase/migrations/` 안의 SQL 파일을 순서대로 붙여넣고 실행
   - 또는 CLI: `npx supabase login` → `npx supabase link --project-ref <프로젝트 ref>` → `npx supabase db push`
3. **Authentication › Sign In / Providers**: “Allow new users to sign up” **끄기** (관리자만 계정 생성)
4. **Authentication › URL Configuration**: Site URL을 운영 주소(Vercel 도메인)로, Redirect URLs에 `http://localhost:3000` 추가
5. **Project Settings › API Keys**에서 URL, Publishable key, Secret key 확인

### 2. 로컬 실행

```bash
npm install
```

`.env.example`을 `.env.local`로 복사하고 위 값 3개를 채운다. Secret key는 채팅·메신저로 공유하지 말고 파일에만 넣는다.

최초 관리자 계정 만들기:

```bash
npm run create-user -- --email chlee@unipoint.co.kr --name 이충호 --role admin --password 임시비밀번호8자이상
```

```bash
npm run dev
```

http://localhost:3000 에서 로그인한다. 이후 사용자는 **사용자 관리** 메뉴에서 추가한다.

### 3. GitHub · Vercel 배포

1. GitHub에 `taems` 저장소(Private)를 만들고 push
2. Vercel에서 **Add New › Project** → `taems` 저장소 Import
3. Environment Variables에 `.env.local`과 같은 3개 값 입력 → Deploy
4. 배포 주소를 Supabase Site URL에 등록 (1-4단계)

## 역할

| 역할 | 메뉴 |
|---|---|
| 관리자 | 전체 + 업무량, 사용자 관리 |
| 엔지니어 | 대시보드, 고객사, 월별 일정, 이슈, 지식베이스, 점검결과서 |
| 영업 | 대시보드, 점검결과서(담당 고객사 다운로드) |

메뉴와 페이지 접근 권한은 `src/lib/roles.ts`의 `NAV_ITEMS` 한 곳에서 정의하고, 데이터 접근은 DB RLS로 다시 막는다.

## 구조

```
src/
  proxy.ts                 세션 갱신, 미로그인 시 /login으로
  lib/auth.ts              getCurrentUser, requireRole (Data Access Layer)
  lib/roles.ts             역할·메뉴·권한 정의
  lib/supabase/            server / proxy / admin(service role) 클라이언트
  app/login/               로그인
  app/(app)/               로그인 후 화면 (사이드바 레이아웃)
    admin/users/           사용자 관리
supabase/migrations/       DB 스키마·RLS
scripts/create-user.mjs    계정 생성 스크립트
```

## 개발 단계

M1 셋업·로그인·역할 ✅ → M2 고객사·엑셀 가져오기 → M3 점검 일정·결과서 → M4 이슈 → M5 지식베이스 → M6 알림·대시보드 → M7 운영 배포
