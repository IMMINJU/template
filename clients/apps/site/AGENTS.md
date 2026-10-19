# 공개 사이트 (Next)

메모 목록을 서버에서 그리는 읽기 전용 공개 페이지. Next 16 App Router + TanStack Query (:5282). 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
app/
├── layout.tsx           # 루트 레이아웃: Providers · globals.css · metadata
├── page.tsx             # 서버 컴포넌트: <Suspense> 안에서 prefetchQuery → HydrationBoundary
├── notes.tsx            # 메모 목록(태그 칩), 클라이언트 컴포넌트: useQuery 만 (쓰기 없음)
├── providers.tsx        # QueryClient (탭마다 하나, staleTime)
├── api.ts               # createClient: 서버 컴포넌트는 notes 를 직접, 브라우저는 같은 출처 /api/notes
└── globals.css          # 색 토큰(라이트/다크) · 화면 스타일
next.config.ts           # rewrites(/api/notes → NOTES_URL) · transpilePackages · standalone(NEXT_OUTPUT)
package.json · tsconfig.json
Dockerfile               # 이미지: standalone 출력을 node server.js 로. NOTES_URL 은 빌드 인자(rewrites) · 실행 env(서버 컴포넌트)
```

## 명령

```bash
pnpm dev · build · start · typecheck · lint · format   # next dev/start (:5282) · next build · tsc --noEmit (TS 6) · oxlint · oxfmt
docker build --build-context workspace=../../.. .   # 이미지 (이 폴더에서)
```

## 규칙

- 서버: notes 하나, `GET /api/notes` 만 부른다. 읽기 전용이라 만들기 · 고치기 · 지우기 화면과 `useMutation` 을 두지 않는다(쓰기는 web · lite).
- `app/api.ts` 하나가 서버와 브라우저를 나눈다: 서버 컴포넌트는 notes 를 직접(`NOTES_URL`, 기본 :8000), 브라우저는 같은 출처 `/api/notes`.
  쿼리 키는 `name` 이 같아서 서버에서 미리 받은 데이터가 브라우저 캐시로 이어진다.
- 서버 컴포넌트가 요청마다 미리 받는다: `<Suspense>` 안에서 `prefetchQuery` → `HydrationBoundary`. `cacheComponents` 라 캐시 안 된 fetch 는
  `<Suspense>` 밖에 두지 않는다. 브라우저 쪽 `staleTime` 으로 붙자마자 다시 받지 않는다(`app/providers.tsx`).
- 브라우저의 `/api/notes` 는 `next.config.ts` 의 `rewrites` 가 notes 로 넘긴다(오래된 목록을 다시 받을 때). **rewrites 주소는 `next build` 때 정해진다**: 다른 서버에 붙이려면
  `NOTES_URL=... pnpm build`. 서버 컴포넌트는 실행할 때 `NOTES_URL` 을 읽는다.
- `next build` 가 TS 의 JS API 로 타입검사를 해서 이 앱은 TS 6(`catalog:ts6`). 워크스페이스 패키지는 `transpilePackages`.
- 빌드할 때 네트워크가 필요한 것(예: `next/font/google`)은 쓰지 않는다.
- 이미지는 standalone 출력(`NEXT_OUTPUT=standalone` 일 때만 켠다, 로컬 `next start` 는 그대로)을 쓴다.
  rewrites 의 `NOTES_URL` 은 빌드 인자, 서버 컴포넌트의 것은 실행할 때 env (둘 다 기본 `http://notes:8000`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
