# 테스트

언어와 상관없이 같은 규칙 (ADR-0003). 공통 설정 · 실제 서버 띄우기 · Fake 넣기 · 격리 방법은 그 서버의 `AGENTS.md`.
왜 이런 규칙인지, 테스트 하나를 줄마다 읽는 예는 [concepts/testing.md](concepts/testing.md).

## 실행 경계

기본은 **서비스 범위의 API 통합 테스트**다. 실제 서버를 랜덤 포트로 띄우고 HTTP · gRPC 로 요청한다.
api · domain · storage 는 실제 구현을 쓰고, 외부 클라이언트(clients)만 Fake 로 바꾼다.

```
HTTP · gRPC → 서버(랜덤 포트) → 본문 검증 → api → domain ─┬─ storage → 테스트 DB (docker 의 Postgres)
HTTP · gRPC ← JSON 응답 ← 오류 변환(400/502) ←────────────┴─ clients → Fake
```

- 테스트 DB 는 운영과 같은 엔진, `docker/docker-compose.middleware.yaml` 의 Postgres 에 서버마다 `<서버>_test` 다.
  먼저 `pnpm infra` (루트 `pnpm test` · CI 는 스스로 띄운다). 개발 DB `<서버>` 는 건드리지 않는다.
- 인증 · 브라우저 · 프록시(vite · next) · 실제 외부 서비스는 이 테스트 범위 밖이다. 필요하면 따로 둔다
  (브라우저까지는 `verify-local` skill).
- 좁은 계층(예: 스트림 전송)만 검사할 때는 domain 을 대역으로 바꿀 수 있지만, 결과도 그 범위로만 해석한다.
- 다른 서버 · 외부를 부르지 않는 서버(templates)는 Fake 가 없다. 실제 서버와 테스트 DB 만으로 본다.

## 인프라 기반 확인

테스트가 기대는 인프라는 `docker/` 의 compose 한 벌이다. 개발 · 테스트 · CI 가 같은 파일로 띄운다.

| 층 | 띄우는 것 | 돌리는 곳 |
|---|---|---|
| 서비스 테스트 (`{METHOD}_specs`) | 서버 프로세스 + Postgres (`docker-compose.middleware.yaml`) | `pnpm test`, CI |
| 전체 스택 (`docker/smoke.sh`) | 서버 · 웹 앱 이미지 + compose 네트워크 + Postgres (`docker-compose.yaml`) | `pnpm stack` (로컬) |

- 경우마다의 동작(성공 · 400 · 502 · 저장 상태)은 서비스 테스트가 본다. 전체 스택은 이미지 · 네트워크 · 환경 변수가 이어지는지만
  본다: 메모 하나를 만들어 notes → tags(태그) → activity(기록) gRPC 흐름이 실제로 이어지는지, templates 가 마이그레이션의 예시를 내주는지,
  웹 앱은 화면 · 그 앱이 부르는 `/api/<서버>` 프록시 · 표에 없는 `/api` 의 JSON 404(web) · site 서버 렌더링.
  서버끼리 부르는 흐름이 새로 생기면 그 흐름 하나를 smoke 에 더한다.
- 인프라(캐시 · 큐 · 스토리지)를 더하면 `docker-compose.middleware.yaml` 에 서비스를 더하고, 테스트용 자원(DB · 버킷 이름)을
  서버마다 따로 둔다. 실제 외부 서비스(결제 · 메일)는 인프라가 아니라 Fake 다.

## 이름

- 디렉터리 = 리소스 경로, 파일 = `{METHOD}_specs` (대문자). Path 변수는 하위 디렉터리:
  `/api/notes` → `notes/GET_specs`, `/api/notes/{id}/tags` → `notes/id/tags/GET_specs`. Go 는 `_test.go` 가 붙는다: `templates/id/PUT_specs_test.go`
- 묶음 이름은 메서드 + 엔드포인트: `GET /api/notes/{id}`. Go 는 묶음이 `func TestPUT` 이라 그 위 주석에 쓴다(`// PUT /api/templates/{id}`).
- gRPC 는 `grpc/{Service}/{Rpc}_specs`(Java 는 패키지가 소문자라 `grpc/activityservice/Record_specs`), 묶음 이름은 gRPC 경로 `/app.tag.v1.TagService/Suggest`.
  상태 코드 자리에 gRPC status 를 쓴다: `action이_비었으면_INVALID_ARGUMENT를_반환한다`.
- 테스트 이름은 한글_밑줄로 조건과 기대 결과: `올바른_메모를_보내면_201_Created를_반환하고_DB에_저장된다`.
  상태 코드가 핵심이면 코드명을, 저장 결과가 핵심이면 저장 결과를 넣는다.
- 기존 API 의 새 사례는 그 `*_specs` 에 추가. 순수 함수 단위 테스트는 목적이 드러나는 이름으로 따로.
- 준비 코드는 `{Domain}Fixture`, 외부 대역은 `Fake{Name}` 처럼 역할을 이름에 드러낸다. 다른 서버의 gRPC 클라이언트 대역도 같다: notes 의 `FakeTagService` · `FakeActivityService`.

## 본문

- Arrange → Act → Assert. 한 테스트는 시나리오 하나, assertion 은 여러 개여도 된다.
- HTTP 응답 · 저장 상태 · 필요한 부수 효과를 함께 검사한다. 저장 상태는 storage 의 저장소로 확인한다
  (테스트에 스키마 SQL 을 다시 쓰지 않는다).
- 오류 응답은 문자열 조각이 아니라 JSON 필드로 비교한다 (`{ error: '...' }`).
- 호출 횟수는 중복 방지 · 재시도처럼 횟수 자체가 계약일 때만 검사한다.

## Fake

- 외부 클라이언트는 교체 지점을 하나 둔다. 실제 구현은 만들 때 외부에 접속하지 않게(처음 호출할 때 연결) 한다.
- mock(`@MockitoBean`, `mock.module`, `patch`)으로 바꾸지 않는다. hook 이 막는다.
- Fake 는 테스트 공통 설정 옆에 두고, 공통 설정에서 한 번 등록한다.
- Fake 는 외부 조건만 통제한다: 반환값 · 다음 호출 실패(`failNext()`) · 받은 인자 기록 · 완료 보류.
  업무 정책이나 재시도를 Fake 안에 다시 구현하지 않는다. 재시도 검증은 "첫 호출 실패, 다음 성공" 으로
  설정하고 재시도는 실제 domain 이 하게 한다.
- Fake 의 실패(예: 연결 실패)를 API 오류 계약(400/502)으로 바꾸는 건 실제 domain · 오류 처리다. 그 연결이 검증 대상이다.
  notes 의 예: `fakeTags.failNext()` 면 502 이고 저장되지 않는다, `fakeActivity.failNext()` 면 그래도 201 이다.
- 상태(실패 플래그 · 카운터 · 마지막 인자 · 기록)는 `reset()` 으로 비우고 공통 설정의 테스트 전후에 부른다.
- 메모리 기록은 실제 발송 성공의 근거가 아니다. 클라이언트 자체(요청 형식 · 인증 · 오류)는 실제 서버나
  계약을 재현한 테스트 서버로 따로 검증한다.

## 격리

- 같은 Fake · DB 를 쓰는 테스트는 병렬로 돌리지 않는다 (한 테스트의 reset 이 다른 테스트를 지운다).
- 서버 · 컨텍스트를 테스트끼리 같이 쓰면 DB · Fake 를 테스트마다 비운다. 서버는 다른 스레드라 rollback 을 가정하지 않는다.
- 비울 때 마이그레이션 기록 표(`flyway_schema_history` · `pgmigrations` · `alembic_version` · `goose_db_version`)는 남긴다. TRUNCATE 는 id 를 되돌리지 않으니 id 는 응답 · 저장소가 준 값을 쓴다.
- 서버마다 테스트 DB 가 달라서 서버끼리는 같이 돌아도 된다 (`pnpm -r test`).
- Go(templates)는 테스트 패키지마다 프로세스 · 서버가 따로지만 DB 는 같이 쓰니 패키지를 하나씩 돌린다(`go test -p 1 ./...`, `t.Parallel()` 없음).

## 스트리밍 (SSE 를 추가하면)

응답을 다 받은 뒤 `data:` 를 검사하면 서버가 모아서 보내도 통과한다. 이벤트를 받은 시점에 서버 쪽 작업이
아직 끝나지 않았는지 확인한다 (완료를 latch · Promise 로 보류했다가 검사 후 풀기, 고정 sleep 금지, 대기 상한 둠).
`X-Accel-Buffering: no` 헤더가 있다고 실제 프록시의 버퍼링까지 검증된 건 아니다.
