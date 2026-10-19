# 서버 추가

이름은 맡은 일로, 언어는 무엇이든 된다. 예시 서버 넷(notes · Node, tags · FastAPI, activity · Spring, templates · Go) 중 가까운 것을 본뜨고 아래 연결 지점을 채운다. 뺄 때는 같은 목록을 거꾸로.

## 1. 폴더와 스크립트

`servers/<이름>/package.json` 에 `dev` · `test` · `gen` · `lint` · `format` (+ 있으면 `typecheck`)을 둔다. JS 가 아니면 자기 도구를 감싼다
(activity 는 `./gradlew`, tags 는 `uv run`, templates 는 `go`). 그래서 루트의 `pnpm test` · `pnpm lint` 가 새 서버에도 돈다.
루트 `pnpm dev` 로 같이 띄우려면 루트 `dev` 의 `--filter` 에도 더한다.

포트는 [development.md](../development.md#포트) 의 표와 겹치지 않게 고른다. 바인딩은 `HOST`, 기본 127.0.0.1.

## 2. 레이어와 공통 규칙

`api → domain → storage · clients` 로 나누고 바깥에서 안으로만 부른다. 쓰기(POST · PUT)는 JSON 본문만, 응답 코드와 오류 `{ "error" }` (400 · 404 · 405 · 502) 는
다른 서버와 같게 한다. → [architecture.md](../architecture.md)

## 3. 계약

- `gen` 스크립트가 서버 코드에서 `contract/openapi/<이름>.json` 을 쓴다. DB 없이 돌아야 한다(`pnpm typecheck` 도 gen 을 돌린다).
- 루트 `package.json` 의 `gen` 과 `contract/index.ts` 에 한 줄씩 더한다: `export type * as <이름> from './openapi/<이름>.ts'`.
- gRPC 를 쓰면 `contract/proto` 에서 코드를 만든다. proto 를 복사하지 않는다.

→ [contracts.md](../contracts.md)

## 4. DB

`docker/postgres/init.sql` 에 두 줄을 더한다.

```sql
CREATE DATABASE <이름>;
CREATE DATABASE <이름>_test;
```

이 파일은 볼륨을 처음 만들 때만 돈다. 이미 띄운 적이 있으면 같은 문장을 직접 실행한다.
연결은 `PGHOST` · `PGPORT` · `PGDATABASE` · `PGUSER` · `PGPASSWORD`, 테스트는 `PGDATABASE` 만 `<이름>_test` 로 바꾼다.

표는 그 언어의 마이그레이션 도구로 만든다. 다른 서버처럼 서버가 요청을 받기 전에 적용하고(테스트도 서버를 띄우며 같이), `gen` 에서는 돌리지 않는다.
테스트의 DB 정리는 그 도구의 적용 기록 표를 남긴다. 도구와 파일 위치는 [database.md](database.md#스키마) 의 표에 한 줄 더한다.

## 5. 테스트

실제 서버를 랜덤 포트로 띄워 HTTP · gRPC 로 부르고, 테스트마다 DB 를 비운다. 외부 클라이언트만 Fake 로 바꾼다. → [testing.md](../testing.md)

## 6. 이미지 · 스택

- `servers/<이름>/Dockerfile`: 컨텍스트는 그 폴더, 공유 파일은 `COPY --from=workspace`, 실행 사용자는 root 가 아니게. → [development.md](../development.md#이미지)
- `docker/docker-compose.yaml` 에 서비스를 더한다.

  ```yaml
  <이름>:
    <<: *server
    build: { context: ../servers/<이름>, additional_contexts: { workspace: .. } }
    ports: ["127.0.0.1:${<이름 대문자>_PORT:-<포트>}:<포트>"]
  ```

  이미지에 공유 파일이 필요 없으면 templates 처럼 `additional_contexts` 를 뺀다. `docker/.env.example` 에도 포트 한 줄(`# <이름 대문자>_PORT=<포트>`)을 더한다.
- 앱이 이 서버를 부르면 그 앱마다 경로 하나를 더한다: 개발 프록시(vite 앱은 `vite.config.ts` 의 `'/api/<이름>'` → `<이름 대문자>_URL ?? 'http://127.0.0.1:<포트>'`, Next 앱은 `next.config.ts` 의 rewrites),
  그 앱의 `nginx.conf.template` 의 `location /api/<이름>` 과 Dockerfile 의 `ENV <이름 대문자>_URL=http://<이름>:<포트>`, compose 에서 그 앱의 `depends_on`.
  서버의 HTTP 경로는 `/api/<이름>` 아래에 둔다. 앱의 프록시가 이 접두사로 서버를 고른다. → [앱 추가](add-app.md#2-서버-부르기)
- `docker/smoke.sh` 에 그 서버의 덩어리(`# <이름>` 부터 빈 줄까지)를 더한다. 다른 서버를 부르는 흐름이 있으면 그 흐름이 이어지는지 하나만 본다.

## 7. 지시 파일

`servers/<이름>/AGENTS.md` 에 구조 · 명령 · 규칙 · 테스트 방법을 쓰고 `ln -s AGENTS.md CLAUDE.md`.

## 이름을 바꿀 때

폴더 이름은 맡은 일이다(`notes` · `tags` · `activity`). 예시를 본떠 다른 일을 맡기면 이름부터 바꾼다(예: `notes` → `orders`).
구현 언어 · 프레임워크는 이름에 넣지 않는다. 그건 그 폴더의 `AGENTS.md` 가 말한다.

1. 폴더를 옮긴다: `git mv servers/notes servers/orders`
2. 이름이 들어간 곳을 찾아 바꾼다. 서버 이름은 패키지 · 계약 · DB · compose · smoke · 환경 변수 · hook · 그 서버를 부르는 앱과 서버에 들어간다.

   ```bash
   n=notes; N=NOTES   # 바꿀 이름
   git grep -n -E "@app/${n}|servers/${n}|${n}\.paths|openapi/${n}\.|'${n}'|\"${n}\"|${n}_test|${N}_(PORT|GRPC|URL)|//${n}:|\[${n}[],]|, ${n}[],]|^  ${n}:|DATABASE ${n}|type ${n}[ ,}]|as ${n} " \
     -- ':!pnpm-lock.yaml' ':!**/uv.lock' ':!*.md' ':!contract/openapi/*'
   ```

   같은 단어의 필드 · CSS 클래스(`tags: string[]` · `className = 'tags'`)는 서버 이름이 아니니 그대로 둔다. `scripts/drop.mjs` 의 `SERVERS` 목록도 바꾼다.
3. 루트에서 확인한다: `pnpm install`(lockfile) → 예전 `contract/openapi/<이름>.*` 를 지우고 `pnpm gen` → `pnpm typecheck` · `pnpm lint` · `pnpm test` → `node scripts/drop.mjs --check`.
4. 이미 띄운 Postgres 에는 새 이름의 DB 가 없다(`init.sql` 은 볼륨을 처음 만들 때만 돈다). 데이터를 옮기려면
   `docker compose -f docker/docker-compose.middleware.yaml exec db psql -U app -d postgres -c 'ALTER DATABASE notes RENAME TO orders'`, 테스트 DB 는 `notes_test` → `orders_test`.
5. 설명은 `git grep -n -w notes -- '*.md'` 로 찾아 고친다. API 경로(`/api/notes`)는 자원 이름이라 서버 이름과 따로 정한다.

## 서버를 뺄 때

`pnpm drop <이름>` 이 같은 목록을 거꾸로 지운다: 폴더, 루트 `gen` · `dev` 와 `contract/index.ts` 의 줄, `contract/openapi/<이름>.*`, init.sql, compose, smoke, `.env.example` 의 포트.
그 서버를 부르는 앱(`<이름>.paths`) · 서버(`<이름>_GRPC`)가 남아 있으면 멈춘다.
→ [development.md](../development.md#예시-빼기). 새 서버를 템플릿에 더했다면 `scripts/drop.mjs` 의 목록에도 더한다.
