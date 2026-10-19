# Notes 서버

메모 CRUD. 앱이 `/api/notes` 로 바로 부른다. 메모를 쓰기 전에 tags 서버에서 태그를 받고, 쓴 뒤 activity 서버에 기록한다(둘 다 gRPC 클라이언트).
Node 24 가 `.ts` 를 빌드 없이 직접 실행한다. 런타임 의존성은 zod · Connect-ES(gRPC 클라이언트) · postgres(postgres.js) · node-pg-migrate(+ pg, 마이그레이션만). HTTP :8000, gRPC 서버는 없다.
DB 는 Postgres(`docker/docker-compose.middleware.yaml`, 먼저 루트에서 `pnpm infra`).
레포 전체 규칙은 루트 `AGENTS.md`, 이 파일이 이 서버에서는 우선한다.

## 구조

폴더 = 레이어 (`docs/architecture.md` 서버 레이어). 의존은 `api → domain → storage · clients` 방향만.

```
src/
├── main.ts              # 진입점: 마이그레이션 → HTTP listen
├── config.ts            # 환경 변수 (HOST · PORT · TAGS_GRPC · ACTIVITY_GRPC)
├── api/http/server.ts   # HTTP 서버: 경로 변수 · JSON 본문 검증 · 오류 변환 + 라우트 표(mergeRoutes)
├── api/http/<도메인>.ts # 라우트 (zod 스키마 = 검증 = 문서)
├── domain/<도메인>.ts   # 업무 로직 (다른 서버를 언제 부르고 실패를 어떻게 다루는지도 여기)
├── storage/db.ts        # Postgres 연결 (PG* 환경 변수, 기본 docker 의 notes DB, 처음 쿼리할 때 연결)
├── storage/migrate.ts   # migrations/ 적용 (node-pg-migrate, 기록은 pgmigrations 표)
├── storage/<도메인>.ts  # 저장소 (SQL)
├── clients/             # 다른 서버 · 외부 시스템 하나당 하나 (tags.ts · activity.ts, 교체 지점과 함께)
├── support/             # route.ts (get · post · put · del · mergeRoutes · match) · errors.ts (BadRequest → 400 · NotFound → 404)
└── openapi.ts           # pnpm gen: 라우트 표 → contract/openapi/notes.json
migrations/              # NNNN_<이름>.sql (-- Up Migration / -- Down Migration). 서버가 뜰 때 적용
package.json             # 스크립트 · 의존성. tsconfig.json · .oxlintrc.json · .oxfmtrc.json 은 타입 · lint · format 설정
.env.template            # 환경 변수 (.env 로 복사, 선택)
Dockerfile               # 이미지 (실행 단계는 dev 의존성 없이)
tests/
├── support/api.ts       # 공통 설정: 테스트 DB(notes_test) 마이그레이션, Fake 등록 · 비우기, 랜덤 포트 HTTP 서버, request · sendJson
├── support/fakes.ts     # 다른 서버 대역 (FakeTagService · FakeActivityService)
├── {resource}/{METHOD}_specs.ts   # notes/GET_specs · notes/id/PUT_specs (경로 변수 = 하위 폴더)
└── **/*.test.ts         # 순수 함수 단위 테스트 (support/route.test.ts)
```

## 명령

```bash
pnpm dev          # node --watch src/main.ts (.env 가 있으면 읽는다)
pnpm test         # node --test (specs + *.test.ts). DB 는 먼저 루트에서 pnpm infra
pnpm gen          # contract/openapi/notes.json (DB 없이)
pnpm migrate create <이름>   # migrations/NNNN_<이름>.sql. 적용은 서버 · 테스트가 시작할 때
pnpm typecheck    # tsc -p . (TS 7)
pnpm lint         # oxlint && oxfmt --check (이 폴더의 .oxlintrc.json · .oxfmtrc.json)
pnpm format       # oxfmt
docker build --build-context workspace=../.. .   # 이미지 (이 폴더에서)
```

## 규칙

- 쓰기 본문은 JSON 만 (`body` 가 있는 라우트는 `api/http/server.ts` 의 `json()` 이 content-type 을 본다). 모르는 필드는 zod 가 버린다.
- 오류는 `{ "error" }`: `BadRequest` · 검증 실패 400, `NotFound` 404, 그 외(태그 서버 실패 등) 502, 없는 경로 404, 다른 메서드 405.
- 바인딩은 `HOST` (기본 127.0.0.1). 컨테이너 등 밖에 열 때 `0.0.0.0`, 그 전에 인증 · TLS.
- DB 연결은 `PGHOST` · `PGPORT` · `PGDATABASE`(기본 `notes`) · `PGUSER` · `PGPASSWORD` (`storage/db.ts`). 쿼리는 postgres.js 의 태그 템플릿(값이 자동으로 바인딩된다). BIGINT 는 문자열로 오니 저장소에서 숫자로 바꾼다.
- 표는 `migrations/` 의 SQL 로만 바꾼다. 서버 · 테스트가 listen 전에 `migrate()` 로 적용한다. 적용된 파일은 고치지 않고 새 파일을 더한다.

## 계약

- 라우트는 `get · post · put · del({ params, body, response }, 핸들러)` (`support/route.ts`). 상태 코드는 200 · 201 · 200 · 204.
  같은 zod 스키마가 입력 검증 · 핸들러 타입 · 문서를 만든다. 핸들러는 검증된 `{ params, body }` 를 받는다.
- 경로 변수는 `'/api/notes/{id}'` 처럼 쓰고 `params: z.object({ id: z.coerce.number().int().positive() })` 로 검증한다
  (실패 400). 문서에는 path parameter 로 풀어 쓰니 `params` 에는 이름을 붙이지 않는다.
- `body` · `response` 스키마는 `.meta({ id })` 로 이름을 붙인다. 이름 없는 스키마는 문서 생성이 실패시킨다.
- 같은 경로(변수 이름만 다른 것도)는 `mergeRoutes` 가, 같은 스키마 id 는 문서 생성(zod)이 실패시킨다.
- 검증 실패 메시지는 한국어(`z.config(z.locales.ko())`).

## 다른 서버 부르기

- `clients/tags.ts`(`TagService.Suggest`) · `clients/activity.ts`(`ActivityService.Record`) 가 gRPC 로 부른다. 주소는 `TAGS_GRPC`
  (기본 `http://127.0.0.1:9002`) · `ACTIVITY_GRPC`(기본 `http://127.0.0.1:9001`). transport 는 처음 부를 때 연결하고, 호출은 3초가 지나면 끊는다.
- 루트 `pnpm gen` 이 `contract/gen` 에 TS 코드를 만든다(buf + protoc-gen-es). `@app/contract/gen/app/<도메인>/v1/<도메인>_pb.js` 로 import. int64 는 `bigint`.
- 각 모듈은 작은 인터페이스(`Tags` · `Activity`)와 교체 지점만 밖에 보인다. domain 은 그 인터페이스만 부른다.
- 실패 정책은 `domain/note.ts`: tags 를 못 부르면 저장하지 않고 502 `{"error":"태그 서버에 연결할 수 없습니다"}`.
  activity 는 저장 뒤라 실패해도 응답은 그대로(201 · 200 · 204), `console.warn` 한 줄만. GET 은 다른 서버를 부르지 않는다.
- 테스트는 `tests/support/fakes.ts` 의 Fake 를 교체 지점(`useTags` · `useActivity`)에 넣는다. 정하는 것은 돌려줄 태그(`fakeTags.tags`) ·
  다음 한 번 실패(`failNext()`), 보는 것은 받은 인자(`fakeTags.texts` · `fakeActivity.records`).

## 테스트

- `tests/support/api.ts` 를 import 하면 그 파일(= 프로세스 하나)에서 테스트 DB `notes_test` 에 마이그레이션을 적용하고, Fake 를 넣고, 서버를 랜덤 포트로 띄웠다가 끝나면 닫는다.
- 묶음 이름 `describe('GET /api/notes/{id}')`, 테스트 이름 `test('없는_id면_404_Not_Found를_반환한다')`.
- 준비 · 저장 상태 확인은 저장소 함수(`create` · `find` · `list`)로 한다.
- 외부 클라이언트는 `clients/` 에 교체 지점을 두고 Fake 를 넣는다. `mock.module` 은 쓰지 않는다(hook 이 막는다).

  ```ts
  // src/clients/tags.ts
  export let tags: Tags = grpcTags
  /** 테스트가 Fake 로 바꿀 때만 쓴다 */
  export const useTags = (t: Tags) => (tags = t)
  ```

- `node --test` 는 파일마다 프로세스가 따로라 서버 · Fake 는 파일끼리 섞이지 않지만 DB 는 같이 쓴다. 그래서 파일을 하나씩 돌리고
  (`--test-concurrency=1`) DB 는 테스트 앞뒤로 `pgmigrations` 를 뺀 모든 표를 `TRUNCATE` 하고 Fake 를 `reset()` 한다. `{ concurrency: true }` 는 쓰지 않는다.
- `TRUNCATE` 는 IDENTITY 를 되돌리지 않는다. id 를 1 로 가정하지 말고 저장소가 돌려준 id 를 쓴다.
