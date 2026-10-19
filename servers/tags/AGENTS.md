# Tags 서버

키워드 → 태그 규칙을 관리하고(HTTP, admin 앱), 메모 내용에 맞는 태그를 준다(gRPC `TagService/Suggest`, notes 가 메모를 저장하기 전에 부른다).
FastAPI · Python 3.12 · uv. HTTP :8002 · gRPC :9002 (같은 프로세스, gRPC 는 lifespan 에서 띄운다), DB 는 Postgres(psycopg 3 · 연결 풀).
레포 전체 규칙은 루트 `AGENTS.md`, 이 파일이 이 서버에서는 우선한다.

## 구조

폴더 = 레이어 (`docs/architecture.md` 서버 레이어). 의존은 `api → domain → storage · clients` 방향만.

```
server/
├── __init__.py          # gen/ 을 import 경로에 넣는다 (proto 패키지 app.tag.v1 그대로)
├── main.py              # 앱 조립: 라우터 · gRPC(lifespan) · security · errors
├── api/routes/rules.py  # HTTP 라우트 /api/tags/rules + pydantic 모델 (검증 = 문서)
├── api/rpc/tags.py      # gRPC TagService (grpc.server, 스레드풀)
├── domain/rules.py      # 업무 로직: 규칙 관리 · suggest (HTTP · gRPC 공용)
├── storage/db.py        # Postgres 연결 풀 (PG* 환경 변수, 기본 docker 의 tags DB, 처음 부를 때 연다) · migrate()
├── storage/rules.py     # 저장소 (SQL)
├── clients/             # 외부 시스템 (생기면)
├── support/errors.py    # 오류 형식 · 422 → 400 · 문서 고치기
├── support/security.py  # JSON 본문만
└── gen.py               # pnpm gen: proto → gen/, 앱 → contract/openapi/tags.json
gen/                     # proto 생성 코드 (gitignore)
migrations/              # Alembic: env.py (연결) · versions/ (리비전, 원시 SQL). 서버가 뜰 때 적용
pyproject.toml           # 의존성(런타임 · dev 그룹) · ruff · pytest · alembic 설정. uv.lock 은 고정된 버전
.env.template            # 환경 변수 (.env 로 복사, 선택)
Dockerfile               # 이미지 (gen 단계에서 proto 생성 · 실행 단계는 dev 의존성 없이, .dockerignore 가 __pycache__ 를 뺀다)
tests/
├── conftest.py          # 공통 설정: 랜덤 포트 uvicorn · gRPC, 테스트 DB(tags_test), fixture client · channel · clean_db
├── {resource}/{METHOD}_specs.py   # tags/rules/GET_specs · tags/rules/id/DELETE_specs (경로 변수 = 하위 폴더)
└── grpc/{Service}/{Rpc}_specs.py  # grpc/TagService/Suggest_specs
```

폴더 이름은 `api/routes` · `api/rpc` 다. `http` · `grpc` 로 지으면 표준 라이브러리 `http` · 라이브러리 `grpc` 와 헷갈린다.

## 규칙

- 쓰기(POST · PUT)는 JSON 본문만 (`support/security.py`). 모르는 필드는 pydantic 이 버린다.
- 오류는 `{ "error" }` (`support/errors.py`): 검증 실패 400 (FastAPI 기본 422 아님), 없는 자원 404 (domain 이 `NotFound`), 그 외 502, 없는 경로 404, 다른 메서드 405.
- 바인딩은 `HOST` (uvicorn `--host` · gRPC 같이, 기본 127.0.0.1). 밖에 열 때 `0.0.0.0`, 그 전에 인증 · TLS.
- DB 는 `docker/docker-compose.middleware.yaml` 의 Postgres (루트에서 `pnpm infra`). 연결은 `PGHOST` · `PGPORT` · `PGDATABASE` · `PGUSER` · `PGPASSWORD`
  (기본 127.0.0.1:5432 · `tags` · app/app).
- 스키마는 Alembic 리비전(`migrations/versions/`)이 정한다. 서버가 뜰 때 lifespan 이 `storage/db.py` 의 `migrate()`
  (`upgrade head`)로 요청을 받기 전에 맞춘다. 테스트도 서버를 띄우며 같이 돈다. `pnpm gen` 은 lifespan 을 돌리지 않아 DB 가 없어도 된다.
- 리비전은 `op.execute(...)` 원시 SQL. SQLAlchemy 는 `migrations/env.py` 의 연결에만 쓰고 앱은 psycopg.
  적용된 리비전은 고치지 않고 새 리비전을 더한다. downgrade 는 두지 않는다(Flyway 처럼 앞으로만).
- 핸들러 · gRPC 메서드는 `def` 다. DB 드라이버가 동기라 스레드풀(FastAPI · `grpc.server(ThreadPoolExecutor())`)에서 돌린다.
  `async def` 안에서 DB 를 부르면 이벤트 루프가 막힌다.

## 명령

```bash
pnpm dev          # gen proto → uvicorn --reload (${HOST:-127.0.0.1}:${PORT:-8002}, .env 가 있으면 읽는다). DB 는 먼저 루트에서 pnpm infra
pnpm test         # gen proto → pytest (DB 가 없으면 5초 안에 멈추고 pnpm infra 를 알린다)
pnpm gen          # gen proto + contract/openapi/tags.json
pnpm typecheck    # gen proto → pyrefly check
pnpm lint         # ruff check + ruff format --check
pnpm format       # ruff check --fix + ruff format
uv run alembic revision -m rule_order --rev-id 0002 # 새 리비전 migrations/versions/0002_rule_order.py (DB 없이)
uv run alembic history                              # 리비전 목록. 적용 상태는 PGDATABASE=tags_test uv run alembic current
uv sync                                             # 의존성 설치 (pyproject.toml · uv.lock)
docker build --build-context workspace=../.. .      # 이미지 (이 폴더에서)
```

## 계약

- FastAPI 가 pydantic 모델 · 라우트에서 문서를 만든다. 모델 이름이 스키마 이름이라 서버 안에서 유일하게(같은 이름 둘은 모듈 경로가 붙은 긴 이름이 된다).
- operationId 는 함수 이름의 camelCase(`list_rules` → `listRules`, `main.py` 의 `generate_unique_id_function`). 서버 안에서 유일하게.
- 검증 실패는 FastAPI 기본 422 · `detail` 이 아니라 400 `{ error }` 다. 문서도 같게 고친다(`support/errors.py` 의 `openapi()`).
- pydantic 은 문자열 자리에 숫자를 받지 않는다. 모르는 필드는 버린다.

## gRPC

- `app.tag.v1.TagService/Suggest`: keyword 가 text 에 들어 있는 규칙의 tag (대소문자 무시, 같은 태그는 한 번, 규칙 id 순, 빈 text 는 []).
  업무 로직은 `domain/rules.py` 의 `suggest()`, rpc 는 넘기기만 한다.
- `python -m server.gen proto` 가 grpcio-tools 로 `gen/` 에 만든다. 타입 스텁은 mypy-protobuf(`--mypy_out` · `--mypy_grpc_out`).
  grpc 기본 생성 코드에는 타입이 없어 pyrefly 가 서비스 메서드를 잘못 본다.
- dev · test · typecheck 가 먼저 proto 를 만든다(`gen/` 은 커밋하지 않는다). 이미지는 gen 단계에서 만든다.

## 테스트

- `conftest.py` 가 uvicorn 을 `port=0` 으로 스레드에서 띄우고 httpx 로 부른다. TestClient 는 소켓을 거치지 않아 쓰지 않는다.
- 파일 `tests/tags/rules/id/DELETE_specs.py`, 모듈 docstring `"""DELETE /api/tags/rules/{id}"""`, 함수 `def test_없는_id면_404_Not_Found를_반환한다(client)`
  (pytest 가 `test_` 로 모은다). 같은 파일 이름이 여러 폴더에 있어서 `--import-mode=importlib`.
- 외부 클라이언트는 `app.dependency_overrides` 나 교체 지점으로 Fake 를 넣는다. `patch('server.clients…')` 는 쓰지 않는다(hook 이 막는다).
- DB 는 docker 의 Postgres 에 있는 `tags_test`(conftest 가 `PGDATABASE` 를 바꾼다). 개발 DB `tags` 는 건드리지 않는다.
- 서버를 세션 동안 한 번 띄워 같이 쓰므로 DB · Fake 는 테스트마다 비운다(`clean_db` 는 autouse, `alembic_version` 을 뺀 테이블을 TRUNCATE).
  마이그레이션이 넣은 예시 규칙도 지워지니 테스트는 필요한 규칙을 `storage/rules.py` 로 직접 만든다.
  TRUNCATE 는 id 를 되돌리지 않으니 id 는 저장소 · 응답이 준 값을 쓴다(1 이라고 가정하지 않는다).
