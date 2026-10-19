# DB 바꾸기

표(스키마)는 서버마다 그 언어의 마이그레이션 도구로 바꾼다. 넷 다 서버가 뜰 때 아직 적용하지 않은 마이그레이션을 적용하고, 테스트도 테스트 DB 에 같은 마이그레이션을 적용한다.
DB 엔진은 Postgres 가 기본이고 서버마다 따로 바꿀 수 있다(ADR-0004).

## 스키마

| 서버 | 도구 | 파일 | 새 마이그레이션 |
|---|---|---|---|
| notes (Node) | node-pg-migrate | `servers/notes/migrations/NNNN_설명.sql` (`-- Up Migration` · `-- Down Migration`) | `pnpm --filter @app/notes migrate create <설명>` |
| activity (Spring) | Flyway | `servers/activity/storage/db-core/src/main/resources/db/migration/V{n}__설명.sql` | 다음 번호로 파일을 더한다 |
| tags (FastAPI) | Alembic | `servers/tags/migrations/versions/NNNN_설명.py` (`op.execute` 로 SQL) | `uv run alembic revision -m <설명> --rev-id NNNN` (그 폴더에서) |
| templates (Go) | goose v3 | `servers/templates/migrations/NNNN_설명.sql` (`-- +goose Up` · `-- +goose Down`, 바이너리에 embed) | 다음 번호로 파일을 더한다 |

- 스키마를 바꿀 때는 다음 번호의 새 파일을 더한다. `main` 에 들어간 마이그레이션을 고치면 이미 적용한 DB 의 기록과 달라진다. activity(Flyway)는 hook 도 막는다.
- 브랜치에서 만든 마이그레이션은 main 을 받을 때마다 번호가 main 의 마지막보다 뒤인지 본다. 겹치면 서버가 뜨지 않을 수 있다 → [troubleshooting.md](troubleshooting.md#브랜치를-바꾼-뒤-서버가-마이그레이션-오류로-뜨지-않는다).
- 적용 기록은 표에 남는다: `pgmigrations` · `flyway_schema_history` · `alembic_version` · `goose_db_version`. 테스트의 DB 정리는 이 표를 남기고 나머지만 비운다.
- notes 의 마이그레이션이 바꾸는 종류마다 예다: `0002_notes` 는 데이터를 옮긴다(메모 하나를 담던 표 → 메모 목록 표 `notes`, 예전 표는 지운다),
  `0003_note_tags` 는 기존 행이 있는 표에 기본값과 함께 열을 더한다.
- `pnpm gen` 은 마이그레이션을 돌리지 않는다. 문서 생성에는 DB 가 필요 없다.

## 개발 DB 를 처음부터

스키마가 꼬이면 그 서버의 개발 · 테스트 DB 를 다시 만든다. 서버가 다시 뜰 때 마이그레이션이 처음부터 적용된다. 그 서버의 개발 데이터는 지워지고 다른 서버의 DB 는 그대로다. 아래는 notes 의 예다. 다른 서버는 `notes` 를 그 서버 이름(`tags` · `activity` · `templates`)으로 바꾼다.

```bash
docker compose -f docker/docker-compose.middleware.yaml exec db psql -U app -d postgres \
  -c 'DROP DATABASE notes WITH (FORCE)' -c 'CREATE DATABASE notes' \
  -c 'DROP DATABASE notes_test WITH (FORCE)' -c 'CREATE DATABASE notes_test'
```

모든 서버를 처음부터 하려면 Postgres 볼륨을 지우고 다시 띄운다.

```bash
docker compose -f docker/docker-compose.middleware.yaml down -v && pnpm infra
```

## 다른 DB 로

테스트도 그 엔진으로 돈다(ADR-0003). Postgres 에 묶인 곳:

| | 고칠 곳 |
|---|---|
| 인프라 | `docker/docker-compose.middleware.yaml` 의 `db`(이미지 · healthcheck · 포트), `docker/postgres/init.sql`(서버마다 DB · `_test`), `docker/docker-compose.yaml` 의 `PGHOST`, `docker/.env.example` 의 `POSTGRES_PORT` |
| notes | `package.json` 의 `postgres` · `pg`(드라이버), `src/storage/db.ts`(연결) · `migrate.ts`, `migrations/*.sql`, `src/storage/*.ts`(SQL), `tests/support/api.ts` 의 `reset` |
| activity | `storage/db-core/build.gradle.kts` 의 `org.postgresql:postgresql` · `flyway-database-postgresql`, `application.properties` · `CoreApiTest.java` 의 `jdbc:postgresql` URL, 저장소 SQL · `db/migration/*.sql`, `CleanDatabase` |
| tags | `pyproject.toml` 의 `psycopg`(드라이버), `server/storage/db.py`(연결 풀), `migrations/env.py`(`postgresql+psycopg` 연결) · `versions/*.py`, `server/storage/*.py`(SQL), `tests/conftest.py` 의 `database` · `clean_db` |
| templates | `go.mod` 의 `pgx/v5`(드라이버), `storage/db.go`(연결 풀 · `Migrate` 의 `goose.DialectPostgres`), `migrations/*.sql`, `storage/*.go`(SQL), `tests/support/api.go` 의 `reset` |
| 공통 | 환경 변수 `PG*`(`servers/*/.env.template` 와 위 연결 코드), 문서(이 파일 · `development.md` · `architecture.md` · `testing.md` · 서버 `AGENTS.md`) |

- 테스트 정리는 마이그레이션 기록 표를 뺀 모든 표를 비운다. 지금은 `pg_tables` 로 표를 찾고 `TRUNCATE` 한다.
  다른 DB 는 `information_schema.tables` 로 찾고, `TRUNCATE` 가 없거나 외래 키에 막히면 `DELETE FROM`.
- `BIGINT GENERATED ALWAYS AS IDENTITY` 와 `RETURNING` 은 Postgres 문법이다. MySQL 은 `AUTO_INCREMENT` 와 따로 읽기, SQLite 는 `INTEGER PRIMARY KEY`.
- Postgres 에 묶인 곳을 새로 만들면 위 표에도 더한다.
