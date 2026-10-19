# 계약

## HTTP: 서버 코드가 기준 (ADR-0001)

서버가 코드에서 openapi 문서를 만들고, 클라이언트 타입은 그 문서에서 만든다. 손으로 쓰는 문서를 따로 관리할 때 생기는 중복을 줄이고,
생성된 타입과 클라이언트 코드가 어긋나면 typecheck 에서 잡는다.

```
서버 코드 ──(pnpm gen)──▶ contract/openapi/<서버>.json ──▶ <서버>.ts ──▶ @app/client 의 createClient<서버.paths>()
```

- `pnpm gen` 순서: proto 코드 → 각 서버가 문서 생성 → TS 타입. `pnpm typecheck` 가 먼저 돌린다 (Java · uv · Go 필요).
- 생성물은 커밋하고 직접 고치지 않는다 (hook 이 막는다). CI 는 `pnpm typecheck`(gen 포함) 뒤 `contract/` 가 커밋과 같은지(`git status --porcelain contract`) 봐서 갱신을 빠뜨린 것을 잡는다.
- 서버마다 문서를 만드는 방법(zod · springdoc · FastAPI · Huma)은 그 서버의 `AGENTS.md`.
- 생성기(openapi-typescript)는 TypeScript 의 JS API 가 필요해서 `contract` 패키지는 TS 6(`catalog:ts6`)을 쓴다 (TS 7 에는 아직 안정된 JS API 가 없다).
- 다른 언어 클라이언트는 `contract/openapi/<서버>.json` 에서 클라이언트를 생성한다.

### 보장하는 범위

| 검사 | 확인하는 것 | 확인하지 않는 것 |
|---|---|---|
| 생성물 비교 | 지금 코드에서 만든 문서 · 타입이 커밋과 같은가 | 실제 서버가 모든 경우에 문서대로 응답하는가 |
| 클라이언트 typecheck | 현재 저장소의 호출 코드가 생성된 타입에 맞는가 | 이미 배포된 옛 클라이언트와의 호환, 응답의 업무적 의미 |
| 서비스 테스트 | 작성한 시나리오의 실제 HTTP · gRPC 응답과 저장 결과 | 작성하지 않은 경우, 실제 외부 서비스 · 배포 환경 |

`@app/client` 는 JSON 응답을 생성된 타입으로 취급하며 런타임 스키마 검증을 하지 않는다. 서버 코드의 타입 단언이나
응답 스키마 선언이 실제 값과 다르면 생성만으로 잡히지 않을 수 있다. 입력 검증 · 응답 검증 · 타입 검사는 서로 다른 일이다.
외부에서 받은 응답을 실행 중에도 검증해야 하면 그 경계에 별도의 스키마 검증을 더한다.

HTTP 의 과거 계약과의 호환을 자동 비교하는 검사도 현재 CI 에는 없다. 기존 소비자가 남아 있으면 필드를 바로 지우거나 이름을 바꾸지 말고,
새 필드를 함께 제공한 뒤 소비자를 옮기는 순서를 정한다. 같은 PR 에서 함께 수정할 수 있다는 것이 동시에 배포된다는 뜻은 아니다.

### 이름 (서버가 늘어도 안 부딪히게)

- 문서는 서버마다 따로 두고 **하나로 합치지 않는다**. 서버끼리 같은 스키마 이름이 생겨도 TS 네임스페이스로 갈린다:
  `notes.components['schemas']['Note']` · `tags.components['schemas']['Rule']`. 외부 도구(API 포털 등)에 넣으려고 꼭 합쳐야 하면
  합칠 때 서버 이름을 접두사로 붙인다 (예: `redocly join --prefix-components-with-info-prop title`).
- 한 서버 안에서는 경로 · 스키마 이름 · operationId 가 유일해야 한다. 서버마다 지키는 방법(그리고 조용히 덮어써지는 곳)은 그 서버의 `AGENTS.md`.
- 서버마다 경로 접두사를 하나 두고(`/api/notes` · `/api/tags` · `/api/activity` · `/api/templates`) 겹치지 않게 한다. 앱은 부르는 서버의
  접두사를 자기 프록시에 두고 그 서버로 바로 넘긴다. 프록시는 경로 · 응답을 바꾸지 않으니 앱은 서버마다의 타입을 그대로 쓴다.

## gRPC: 공통 proto 가 기준 (ADR-0002)

서버 간 통신의 기본은 gRPC 다. 공통 proto 는 `contract/proto` 하나만 두고 서버마다 복사하지 않는다
(여러 언어가 같은 파일을 읽어야 해서 HTTP 와 달리 proto 가 기준이다). 언어별 생성 방법은 그 서버의 `AGENTS.md`.

- buf 로 lint(STANDARD) · 호환 검사(FILE). 디렉터리 = 패키지(`app/tag/v1` → `app.tag.v1`).
- 예시: `app.tag.v1.TagService/Suggest`(tags 가 구현, notes 가 부른다) · `app.activity.v1.ActivityService/Record`(activity 가 구현, notes 가 부른다).
  proto 하나를 Python(grpcio) · Java(grpc-java)가 서버로, TS(Connect-ES)가 클라이언트로 쓴다.
- 언어별 옵션(`option java_multiple_files` 등)은 같은 proto 에 둔다.
- 필드 번호는 바꾸거나 다시 쓰지 않는다 (지운 필드는 `reserved`). 배포된 서버끼리 버전이 섞이기 때문이다.
  CI 는 변경 전 커밋과 `buf breaking` 으로 비교한다. 로컬에서는 `contract/` 에서 `pnpm exec buf breaking --against '../.git#branch=main,subdir=contract'`.
  호환을 꼭 깨야 하면 `v2` 패키지를 새로 만든다.
- 오류는 gRPC status (잘못된 입력 `INVALID_ARGUMENT`, 없음 `NOT_FOUND`, 다른 서버 · 외부 실패 `UNAVAILABLE`).
- 다른 서버의 gRPC 클라이언트는 외부 클라이언트다: `clients/` 에 두고 테스트에서는 Fake 로 바꾼다. 실패했을 때 응답을 어떻게 할지는
  호출마다 정한다 ([architecture.md](architecture.md) 의 서버 공통 규칙, 순서는 [guides/call-server.md](guides/call-server.md)).
- 평문 HTTP/2(h2c)다. 서버 밖으로 열 때는 TLS(mTLS) · 인증부터.

필드 변경을 직접 실패시켜 보는 절차는 [계약을 깨뜨려 보기](guides/contract-lab.md)에 있다.
