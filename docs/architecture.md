# 구조

pnpm 워크스페이스 하나에 서버 · 클라이언트를 여럿 둔다. 서버 · 클라이언트는 언어 · 프레임워크가 달라도 되고,
서로를 잇는 건 `contract/` 의 언어 중립 계약뿐이다: 클라이언트 ↔ 서버는 HTTP/JSON(각 서버가 코드에서 만든
`openapi/<서버>.json`), 서버 ↔ 서버는 gRPC(공통 `proto/`). 계약은 [contracts.md](contracts.md).
왜 이렇게 나눴는지는 [concepts/structure.md](concepts/structure.md).

```
template/
├── contract/
│   ├── openapi/<서버>.json · .ts     # 서버가 코드에서 만든 HTTP API 문서 · 그 TS 타입 (`pnpm gen`, 직접 고치지 않음)
│   ├── index.ts                      # @app/contract: 서버별 네임스페이스 (notes · tags · activity · templates)
│   ├── proto/app/{도메인}/v1/*.proto  # 서버 ↔ 서버 gRPC 계약 (기준). 디렉터리 = 패키지
│   ├── buf.yaml · buf.gen.yaml       # buf lint(STANDARD) · breaking(FILE) · TS 코드 생성 설정
│   └── gen/                          # proto 의 TS 코드 (@app/contract/gen/..., 직접 고치지 않음)
├── servers/                  # 서버 하나 = 폴더 하나, 이름은 맡은 일. 서버마다 자기 언어 · API · 도구를 갖는다
│   ├── notes/                # 메모, 저장할 때 tags · activity 를 부른다 — Node 24 · zod · Connect-ES (:8000)
│   ├── activity/             # 활동 기록 — Spring Boot 4.1 · Java 25 · Gradle 멀티 모듈 (:8001 · gRPC :9001)
│   ├── tags/                 # 태그 규칙 · 태그 매기기 — FastAPI · Python 3.12 · uv (:8002 · gRPC :9002)
│   └── templates/            # 메모 템플릿 — Go 1.25 · Huma v2 · pgx v5 · goose v3 (:8003)
├── clients/                  # 앱 여섯과 공용 API 클라이언트. lint · format 설정은 클라이언트 전체가 하나
│   ├── apps/
│   │   ├── web/              # 웹 앱 (React)
│   │   ├── admin/            # 관리 앱 (Vue)
│   │   ├── site/             # 공개 사이트 (Next)
│   │   ├── lite/             # 가벼운 웹 앱 (순수 TS)
│   │   ├── mobile/           # 모바일 앱 (Expo)
│   │   └── desktop/          # 데스크톱 앱 (Tauri)
│   ├── packages/client/      # @app/client: 서버가 만든 타입으로 API 를 부르는 공용 fetch
│   └── .oxlintrc.json · .oxfmtrc.json  # 클라이언트 공통 lint · format 설정
├── docker/                   # 인프라(Postgres) · 전체 스택 compose · smoke.sh. 개발 · 테스트 · CI 가 같이 쓴다
├── .github/                  # CI (workflows/ci.yml) · PR 템플릿
├── scripts/                  # rename.mjs(이름 바꾸기, 한 번 쓰고 지워진다) · drop.mjs(쓰지 않는 예시 서버 · 앱 빼기)
├── docs/                     # 규칙 · 이해하기(concepts/) · 절차(guides/) · 설계 결정(decisions/)
├── DESIGN.md                 # UI 의 기준: 색 · 글자 · 간격 · 컴포넌트 토큰과 규칙 (DESIGN.md 형식)
├── .agents/skills/           # 에이전트 skill (.claude/skills 는 이 폴더로 가는 링크)
├── .claude/                  # Claude Code 설정 · hook (settings.json, hooks/). 개인 설정은 settings.local.json (gitignore)
├── pnpm-workspace.yaml       # 패키지 목록 · 클라이언트 의존성 카탈로그 · 설치 스크립트 허용 목록
└── tsconfig.base.json        # TS 패키지 공통 설정
```

각 서버 · 클라이언트의 세부는 그 폴더의 `AGENTS.md`.

예시 서버 넷은 맡은 일이 다르다. 메모를 쓰는 요청 하나에 notes · tags · activity 가 함께 움직이고, templates 는 메모 템플릿만 맡는다.
앱은 부르는 서버마다 자기 프록시에 경로(`/api/<서버>`)를 하나 두고 그 서버를 HTTP 로 바로 부른다.

```
admin (Vue) ──▶ tags (태그 규칙 · FastAPI)
  ├──▶ activity (활동 기록 · Spring)
  └──▶ templates (템플릿 · Go)
web (React) ──▶ templates
  └──▶ notes (메모 · Node)
site (Next) ──▶ notes
lite (순수 TS) ──▶ notes
```

mobile · desktop 은 프록시 없이 `base` 에 notes 주소를 바로 준다(아래 [클라이언트](#클라이언트)).

서버끼리는 gRPC 로 부른다. 메모를 저장하는 요청 하나에 notes 가 다른 두 서버를 부른다.

```
notes (Node) ──gRPC──▶ tags (FastAPI)        저장 전에 태그를 묻는다
  └──gRPC──▶ activity (Spring)               저장 뒤 기록을 남긴다
```

폴더 이름은 맡은 일이고 구현 언어는 그 서버의 선택이다. 같은 일을 언어마다 어떻게 쓰는지는 [languages.md](languages.md).

## 서버 레이어

모든 서버가 같은 레이어로 나누고, 바깥에서 안으로만 부른다.

```
api (HTTP 라우트 · gRPC 서비스 · 보안) → domain (업무 로직, HTTP · gRPC 공용) → storage (DB) · clients (외부 시스템 하나당 하나)
support: 오류 형식 · 라우트 도구처럼 레이어와 무관한 것
```

| 레이어  | notes · Node (`src/`)     | activity · Spring (모듈)                                       | tags · FastAPI (`server/`) | templates · Go (패키지) |
| ------- | ------------------------- | -------------------------------------------------------------- | -------------------------- | ----------------------- |
| 진입점  | `main.ts`                 | `core/core-api` `CoreApiApplication`                           | `main.py` (uvicorn)        | `main.go`               |
| api     | `api/http/`               | `core/core-api` `app.core.api.{controller,grpc}`               | `api/routes/` · `api/rpc/` | `api/` (Huma)           |
| domain  | `domain/`                 | `core/core-api` `app.core.domain.*`                            | `domain/`                  | `domain/`               |
| storage | `storage/` (postgres.js) · `../migrations/` (node-pg-migrate) | `storage/db-core` (JdbcClient + Flyway) | `storage/` (psycopg 3) · `../migrations/` (Alembic) | `storage/` (pgx) · `migrations/` (goose, embed) |
| clients | `clients/` (tags · activity 의 gRPC) | `clients/client-*` 모듈 (예시 `client-example`: 외부 HTTP 하나) | `clients/` (생기면) | `clients/` (생기면) |
| support | `support/`                | `core/core-api` `app.core.support.*`                           | `support/`                 | `support/`              |

- domain 이 storage 를 그대로 넘기기만 하는 위임도 레이어라서 둔다.
- clients 는 밖에 인터페이스(교체 지점)만 보이고 구현은 숨긴다. 테스트에서는 Fake 로 바꾼다 ([testing.md](testing.md)).
- 레이어를 넘는 타입: 필드만 있는 단순 데이터 타입(record · dataclass · TS 타입)은 넘겨 써도 된다. 예: activity 의 api 는 storage 의 `ActivityEntity`(record)를 받아 응답 타입으로 바꾼다.
  DB 연결 · 쿼리 결과 객체 · ORM 의 지연 로딩 객체는 storage 밖으로 내보내지 않는다. 저장 형식과 업무 모델이 달라지기 시작하면 domain 이 자기 반환 모델을 두고 그 안에서 바꾼다.
  clients 는 외부의 요청 · 응답 형식을 안에 두고 자기 결과 타입만 내준다. 주소 · timeout 은 client 마다 설정에 둔다 (→ activity 의 `clients/client-example`).
- 트랜잭션: 한 업무의 DB 쓰기 여럿을 묶을지는 domain 이 정하고, 트랜잭션을 여는 수단은 storage 가 내준다(domain 은 DB 연결을 모른다).
  지금 예시 서버의 업무는 쓰기가 하나씩이라 트랜잭션이 없다.

## 서버 공통 규칙

언어가 달라도 다음은 같게 한다 (클라이언트가 서버를 가리지 않게). 서버마다 어디서 지키는지는 그 서버 `AGENTS.md` 의 "규칙":

- `package.json` 에 `dev` · `test` · `gen` · `lint` · `format` (+ 있으면 `typecheck`) 스크립트. JS 가 아닌 서버는 자기 도구를
  감싼다. 그래서 루트의 `pnpm -r` 이 모든 서버에 돈다.
- lint · format · 의존성 버전은 서버마다 자기 언어 도구 · 자기 설정. 루트에 언어별 설정을 두지 않는다.
  클라이언트는 공통 설정 · 카탈로그 (아래 [클라이언트](#클라이언트)).
- 포트는 `PORT`(HTTP) · `GRPC_PORT`(gRPC). 서버를 여럿 띄우면 서로 다르게 ([development.md](development.md) 의 포트 표).
  부르는 다른 서버의 주소는 `<서버>_GRPC`(예: notes 의 `TAGS_GRPC`), 앱의 프록시가 넘길 서버의 HTTP 주소는 `<서버>_URL`(예: `NOTES_URL`).
- 바인딩 주소는 `HOST`, 기본 127.0.0.1 (HTTP · gRPC 같이). 컨테이너 등 밖에 열 때는 `HOST=0.0.0.0`.
  예시 서버에는 인증이 없으니 밖에 열기 전에 인증을 붙이고 gRPC 는 TLS(mTLS)로.
- 쓰기(POST · PUT)는 JSON 본문만 받는다 (form 같은 단순 요청은 다른 사이트에서 몰래 보낼 수 있다). DELETE 는 본문 없이. 입력은 신뢰 경계:
  문서에 적힌 필드 · 타입만 받고 모르는 필드는 버린다.
- 응답 코드: 만들기 201(만든 것을 돌려준다), 지우기 204(본문 없음), 나머지 200. 오류는 `{ "error": "..." }`: 잘못된 입력 400, 없는 자원 · 라우트 404, 다른 메서드 405, 서버 · 다른 서버 · 외부 서비스 오류 502.
- 다른 서버 · 외부 서비스 호출은 DB 트랜잭션에 묶이지 않는다. 트랜잭션 안에서 불러도 롤백이 그 호출을 되돌리지 않고, 호출이 성공했어도 커밋은 실패할 수 있다.
  그래서 실패할 때 어떻게 할지는 호출마다 정해 그 서버 `AGENTS.md` 에 적는다. 예시: notes 는 태그 없이는 저장하지 않으니
  tags 를 저장 전에 불러 실패면 502, 활동 기록은 저장을 막을 이유가 없으니 저장 뒤에 불러 activity 실패면 경고만 남기고 응답한다(기록은 빠질 수 있다).
  → [guides/call-server.md](guides/call-server.md#4-실패하면-어떻게-할지)
- DB 는 Postgres (`docker/docker-compose.middleware.yaml`, ADR-0004, 바꾸려면 [guides/database.md](guides/database.md)). 서버마다 자기 DB(`<서버>`, 테스트 `<서버>_test`)를 갖고,
  다른 서버의 DB 를 직접 읽지 않는다(gRPC 로 부른다). 연결은 `PGHOST` · `PGPORT` · `PGDATABASE` · `PGUSER` · `PGPASSWORD`.
- 서버마다 `Dockerfile` ([development.md](development.md) 의 "이미지").
- 앱이 부르는 서버는 경로 접두사(`/api/<서버>`)를 하나 두고 서버마다 겹치지 않게 한다. 그 서버를 부르는 앱의 프록시에 그 접두사를 한 줄 더한다.

## 클라이언트

모두 JS/TS 이고 `@app/client` 의 `createClient<서버.paths>()` 로 서버를 부른다. 앱은 부르는 서버마다 자기 프록시에 경로를 두고 그 서버를 바로 부른다.
아래는 모든 앱이 같이 따르는 것이고, 앱마다의 구조 · 명령 · 서버 부르는 방식은 그 앱의 `AGENTS.md`(`clients/apps/<앱>/`).

### 서버 부르기

TS 앱은 부를 서버마다 클라이언트를 하나 만든다. 모든 서버의 타입이 열려 있지만 경로마다 생기는 코드는 없어서
API 가 늘어도 번들은 그대로다. 다른 언어 앱은 `contract/openapi/<서버>.json` 에서 클라이언트를 생성한다 ([contracts.md](contracts.md)).

```ts
import { createClient, type notes } from '@app/client'
const api = createClient<notes.paths>({ name: 'notes', base: 'http://127.0.0.1:8000' }) // name · base(서버 주소) · fetch 는 선택
await api.get('/api/notes') // 경로 · 응답 타입은 notes 서버 문서에서
await api.post('/api/notes', { text }) // 201 본문(만든 메모)을 돌려준다. put 은 (경로, 본문, { params })
await api.delete('/api/notes/{id}', { params: { id } }) // 경로 변수가 있으면 params 가 필수(빼면 타입 오류), 204 는 void
useQuery(api.query('/api/notes')) // TanStack Query (React · Vue). 키 = [name, 경로, params, query]
```

- `name`: 쿼리 키의 첫 칸. 경로가 같은 서버가 둘이어도 캐시가 섞이지 않게. 주소가 아니라 이름이라 서버 렌더링(절대 주소)과 브라우저(상대 경로)의 키가 같다.
- `base`: 같은 출처(프록시)면 생략, 네이티브 앱 · 서버 렌더링은 그 서버의 주소(mobile `EXPO_PUBLIC_NOTES_URL`, site 의 서버 컴포넌트 `NOTES_URL`).
  `fetch`: CORS 없는 fetch 가 필요할 때(Tauri, 부를 주소는 `src-tauri/capabilities/default.json` 의 허용 목록에도).
- 같은 출처 프록시는 앱마다 그 앱이 부르는 서버만 둔다: `/api/<서버>` → `<서버>_URL`. 개발은 vite(`vite.config.ts`), 이미지는 nginx(앱 폴더의 `nginx.conf.template`),
  site 는 Next 의 rewrites(`next.config.ts`). nginx 는 표에 없는 `/api` 에 서버들과 같은 JSON 404(`{"error":"not found"}`)를 낸다.
- 서버가 꺼져 있으면 프록시(vite · nginx)가 JSON 이 아닌 502 를 내서 `@app/client` 의 오류는 `API 오류 (HTTP 502)` 다.
- 부르는 서버: web → notes · templates, admin → tags · activity · templates, site · lite · mobile · desktop → notes.
  서버를 여럿 부르는 앱은 클라이언트도 서버마다 하나다(admin: `createClient<tags.paths>({ name: 'tags' })` · `activity` · `templates`).

### 서버 데이터

- TanStack Query (`@tanstack/react-query` · `@tanstack/vue-query`). 쿼리 옵션은 손으로 짜지 않고 `api.query()` 를 쓴다.
- 만들기 · 고치기 · 지우기 뒤에는 `invalidateQueries({ queryKey: api.query('/api/notes').queryKey })` 로 목록을 다시 받는다.
- 프레임워크가 없는 앱(lite · desktop)은 `api.get` · `post` · `put` · `delete` 그대로.
- API 응답 문자열은 텍스트로만 렌더한다 (`innerHTML` · `v-html` · `dangerouslySetInnerHTML` 금지, hook 이 막는다).

### 의존성 · 도구

- 버전은 `pnpm-workspace.yaml` 카탈로그 한 곳에서 (`"react": "catalog:"`). Expo 가 정하는 버전은 `catalog:expo`
  (올릴 때 `npx expo install --fix`), TS 의 JS API 가 필요한 도구(admin 의 vue-tsc · site 의 next build)는 `catalog:ts6`. 서버는 카탈로그를 쓰지 않는다.
- `react` · `react-dom` 은 워크스페이스 전체가 **정확히 같은 한 버전**(Expo 가 정한 것)이다. `^` 범위로 두면 pnpm 이 둘을 따로 골라,
  테스트 · 빌드는 통과하고 브라우저에서만 화면이 빈다.
- 클라이언트의 모든 패키지에 `lint`(`oxlint && oxfmt --check`) · `format`, 앱에는 `typecheck`. 기본은 TS 7(`tsc -p .`)이고,
  `catalog:ts6`(TS 7 에는 아직 안정된 JS API 가 없다) · `catalog:expo` 를 쓰는 admin · site · mobile 만 TS 6 이다.
- 웹 앱(web · admin · site · lite)은 `Dockerfile` 이 있다. 정적 앱은 nginx 가 `/api/<서버>` 를 그 서버로 넘기고(앱 폴더의 `nginx.conf.template`), site(Next)는 standalone.
  mobile · desktop 은 네이티브 빌드라 이미지가 없다 ([development.md](development.md) 의 "이미지").
- 새 앱은 [guides/add-app.md](guides/add-app.md).

### UI

색 · 글자 · 간격 · 둥글기 · 컴포넌트와 그 쓰임은 저장소 루트의 [DESIGN.md](../DESIGN.md) 가 기준이다
([DESIGN.md 형식](https://github.com/google-labs-code/design.md): 앞의 YAML 이 값, 본문이 규칙). 새 값이 필요하면 거기 먼저 더하고,
`pnpm dlx @google/design.md@0.4.0 lint DESIGN.md` 로 확인한다.
