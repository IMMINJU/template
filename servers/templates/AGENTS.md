# Templates 서버

템플릿(이름 · 내용) CRUD. 다른 서버를 부르지 않고, 다른 서버도 이 서버를 부르지 않는다(clients 없음, gRPC 없음).
Go 1.25 · Huma v2(코드에서 OpenAPI 3.1 · 입력 검증, `humago` 로 표준 `net/http` ServeMux 위에) · pgx v5 · goose v3. HTTP :8003.
DB 는 Postgres(`docker/docker-compose.middleware.yaml`, 먼저 루트에서 `pnpm infra`).
레포 전체 규칙은 루트 `AGENTS.md`, 이 파일이 이 서버에서는 우선한다.

## 구조

폴더 = 레이어 = Go 패키지 (`docs/architecture.md` 서버 레이어). 의존은 `api → domain → storage` 방향만. 패키지 이름은 `http` 로 짓지 않는다(표준 라이브러리와 겹친다).

```
main.go                  # 진입점: 환경 변수(HOST · PORT) → 마이그레이션 → listen. `go run . gen` 은 문서만 쓰고 끝난다 (DB 없이)
api/server.go            # New(): ServeMux + Huma 설정 · JSON 본문 검사 · 오퍼레이션이 없는 경로 404 · 메서드 405
api/errors.go            # Huma 오류를 { "error" } 로 (huma.NewError 교체) · 문서의 오류 응답 · writeError
api/<도메인>.go          # 오퍼레이션 (요청 · 응답 타입의 태그 = 검증 = 문서)
domain/<도메인>.go       # 업무 로직. 지금은 storage 로 넘기기만 하고, 없는 자원을 support.NotFound 로 바꾼다
storage/db.go            # 연결 풀 (PG* 환경 변수, 기본 docker 의 templates DB, 처음 부를 때 만들고 처음 쿼리할 때 연결) · Migrate
storage/<도메인>.go      # 저장소 (SQL). 필드만 있는 struct 를 돌려준다
support/errors.go        # 오류 형식 Error{Status, Message} → { "error" } · NotFound
migrations/              # NNNN_<이름>.sql (goose: -- +goose Up / -- +goose Down) · migrations.go (embed, 바이너리에 넣는다)
go.mod · go.sum          # module templates, 의존성 버전
package.json             # 스크립트 (go 명령을 감싼다)
.env.template            # 환경 변수 (.env 로 복사, 선택)
Dockerfile               # 이미지 (golang 으로 빌드, distroless nonroot 에서 실행. 컨텍스트는 이 폴더)
tests/
├── support/api.go       # 공통 설정: 테스트 DB(templates_test) 마이그레이션, 랜덤 포트의 실제 핸들러, Run(앞뒤로 DB 비우기) · Do · SendJSON · Decode · AssertError
├── support/templates.go # 준비 · 저장 상태 확인 (storage 함수 + t.Fatal)
├── support/routes_test.go           # 오퍼레이션이 없는 경로 404 · 메서드 405
└── {resource}/{METHOD}_specs_test.go # templates/GET_specs_test.go · templates/id/PUT_specs_test.go (경로 변수 = 하위 폴더)
```

## 명령

```bash
pnpm dev          # go run . (.env 가 있으면 읽는다). DB 는 먼저 루트에서 pnpm infra
pnpm test         # go test -p 1 ./... (패키지를 하나씩). DB 는 먼저 루트에서 pnpm infra
pnpm gen          # contract/openapi/templates.json (DB 없이)
pnpm typecheck    # go vet ./...
pnpm lint         # gofmt -l 이 비어 있는지 + go vet
pnpm format       # gofmt -w .
docker build .    # 이미지 (이 폴더에서)
```

## 규칙

- 쓰기 본문은 JSON 만: 본문이 있는 오퍼레이션은 `Content-Type` 이 `application/json` 이 아니면 400 `{"error":"JSON 본문이 필요합니다"}` (Huma 미들웨어 `jsonOnly`, 정의는 `api/errors.go` · 등록은 `api/server.go`). 본문은 256KB 까지(`MaxBodyBytes`).
- 오류는 `{ "error" }` (`application/json; charset=utf-8`): 검증 실패 · 깨진 JSON · 너무 큰 본문 400, 없는 자원 404(domain 이 `support.NotFound`), 그 외 502(오류 메시지 그대로), 없는 경로 404 `not found`, 다른 메서드 405 `method not allowed`.
- Huma 기본값을 공통 규칙에 맞춘 곳:
  - `huma.NewError` 를 `api/errors.go` 의 `init` 에서 바꾼다. 4xx(404 · 405 빼고: 422 · 413 · 415 …)는 400, 5xx 는 502, 본문은 `*support.Error`(problem+json 아님). `support.Error` 의 `ContentType` 이 응답 헤더를 정한다.
  - 모르는 필드: Huma 는 struct 스키마마다 `additionalProperties: false` 로 거절한다. `New()` 가 등록이 끝난 뒤 모든 스키마의 `AdditionalProperties` 를 비워 받게 하고, struct 에 없는 필드는 버려진다.
    키 이름은 대소문자까지 맞춘다: `Name` 은 `name` 이 아니라 모르는 필드다. Huma 는 검증도 구조체에 넣기도 encoding/json 처럼 대소문자 없이 맞추는 게 기본이라
    `huma.ValidateStrictCasing = true` 와 `exactJSON`(구조체에 넣을 때 이름이 똑같은 키만) 둘 다 둔다(`api/server.go`). 한쪽만 바꾸면 검증한 값과 저장하는 값이 갈린다.
    `_ struct{} \`additionalProperties:"true"\`` 를 쓰지 않는 것은 문서에 `true` 가 적혀 클라이언트 타입에 `[key: string]: unknown` 이 붙기 때문이다(비우면 tags 문서처럼 적지 않는다).
  - 문서 · 스키마 경로(`/openapi` · `/docs` · `/schemas`)와 응답에 `$schema` 를 넣는 기본 훅을 끈다(`config.CreateHooks = nil`).
  - 오퍼레이션이 없는 요청은 Huma 를 거치지 않는다. 문서의 경로마다 메서드 없는 패턴(405)과 `/`(404)를 ServeMux 에 등록한다. ServeMux 는 메서드가 붙은 패턴을 먼저 고른다.
- 레이어를 넘는 타입: storage 는 필드만 있는 `storage.Template` 을 돌려주고 api 가 응답 타입 `api.Template` 으로 바꾼다(필드가 같아 변환 `Template(t)`). pgx 의 풀 · 행은 storage 밖으로 내보내지 않는다(테스트 공통 설정의 TRUNCATE 만 `storage.DB()` 를 쓴다).
- 바인딩은 `HOST` (기본 127.0.0.1) · `PORT` (기본 8003). 이미지는 `HOST=0.0.0.0`. 밖에 열기 전에 인증 · TLS.
- DB 연결은 `PGHOST` · `PGPORT` · `PGDATABASE`(기본 `templates`) · `PGUSER` · `PGPASSWORD` (`storage/db.go`). 쿼리는 pgx 의 `$1` 바인딩, 행은 `pgx.RowToStructByPos` 로 struct 에.
- 표는 `migrations/` 의 SQL 로만 바꾼다(goose, 기록은 `goose_db_version` 표). 서버 · 테스트가 listen 전에 `storage.Migrate` 로 적용한다. 파일은 embed 로 바이너리에 들어가니 이미지에 따로 복사하지 않는다.
  적용된 파일은 고치지 않고 새 번호(`0002_<이름>.sql`)를 더한다. `0001_templates.sql` 은 예시 하나(`회의록`)를 넣는다(tags 의 예시 규칙이 회의 · 할 일 에 태그를 매긴다).
- 의존성은 `go.mod` 의 `go 1.25` 를 지키는 버전으로 고른다(goose v3.28 부터는 Go 1.26 이 필요하다). 올릴 때 `GOTOOLCHAIN=local go get <모듈>@<버전>`.

## 계약

- Huma 가 `huma.Register` 의 오퍼레이션 · Go 타입에서 문서를 만든다(`api.New()` 의 `OpenAPI()`, `pnpm gen` 이 2칸 들여쓰기 JSON 으로 쓴다). 맵 키가 정렬돼 몇 번 돌려도 같다.
- 스키마 이름은 Go 타입 이름(`Template` · `TemplateInput` · `TemplateList` · `Error`)이라 이 서버 안에서 유일하게. operationId 는 직접 적는다(`listTemplates` · `createTemplate` · `updateTemplate` · `deleteTemplate`). Huma 는 같은 operationId 가 둘이면 등록할 때 실패한다.
- 검증은 필드 태그: `minLength` · `maxLength` · 경로 변수 `minimum:"1"`. 문서도 같은 태그에서 나온다.
- 오류 응답은 `Responses: errorResponses(api, 400, 404, 502)` 로 실제 내는 것만 적는다. `Operation.Errors` 는 쓰지 않는다(Huma 가 422 · 500 을 덧붙인다).
- 목록 같은 slice 는 `nullable:"false"` 를 붙이고 빈 값도 `make` 로 만든다(nil 이면 `null` 이 나간다).

## 테스트

- `tests/support` 의 `Run(t, 이름, f)` 이 처음 불릴 때 그 테스트 프로세스(= go test 의 패키지 하나)에서 `PGDATABASE=templates_test` 로 바꾸고 마이그레이션을 한 번 적용한 뒤
  실제 `api.New()` 를 `httptest.NewServer` 로 랜덤 포트에 띄운다. Postgres 에 못 붙으면 "pnpm infra 를 먼저 띄운다" 를 찍고 바로 끝난다.
- 묶음은 파일 하나에 `func Test<METHOD>` 하나, 그 위에 `// PUT /api/templates/{id}`. 테스트 이름은 `support.Run(t, "없는_id면_404_Not_Found를_반환한다", ...)`.
- `Run` 이 테스트 앞뒤로 `goose_db_version` 을 뺀 모든 표를 TRUNCATE 한다. 마이그레이션의 예시 행도 지워지니 테스트는 필요한 행을 직접 만든다. id 는 되돌리지 않으니 저장소 · 응답이 준 값을 쓴다.
- 준비 · 저장 상태 확인은 저장소 함수로 한다(`support.CreateTemplate` · `Templates` · `MissingID`). mock 은 쓰지 않는다(ADR-0003).
- 응답은 `support.Decode[storage.Template]` 처럼 읽는다. 모르는 필드가 오면 실패하니 버려야 할 필드가 응답에 섞였는지도 본다. 오류는 `AssertError` 로 상태 코드 · Content-Type · `{ error }` 를 비교한다.
- 패키지끼리 서버는 따로지만 DB 는 같이 쓰므로 `go test -p 1`, `t.Parallel()` 은 쓰지 않는다.
