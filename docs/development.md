# 개발

## 명령

```bash
pnpm install
pnpm infra         # docker 의 Postgres (dev · test 가 먼저 부른다). 끄기 pnpm infra:down
pnpm dev           # 기본 조합: 서버 넷(notes · tags · activity · templates) + web → http://localhost:5280
pnpm test          # 모든 서버의 test (activity 는 Java 25, tags 는 uv, templates 는 Go 필요)
pnpm stack         # 서버 · 웹 앱 이미지를 빌드해 전체 스택을 띄우고 docker/smoke.sh. 끄기 pnpm stack:down
pnpm gen           # proto → contract/gen, 각 서버 코드 → contract/openapi/<서버>.json → .ts
pnpm typecheck     # gen + 모든 패키지의 typecheck
pnpm lint          # 모든 패키지의 lint (각자 도구)
pnpm format        # 모든 패키지의 format
pnpm --filter @app/<패키지> <스크립트>   # 하나만. 예: @app/activity dev, @app/admin dev, @app/mobile ios, @app/desktop start
```

필요한 도구: Node 24(`.nvmrc`) · pnpm 12 · Docker(compose v2.20+), activity 는 Java 25, tags 는 uv(Python 3.12), templates 는 Go 1.25(`go.mod`), desktop 은 Rust(`rust-toolchain.toml` 이
버전을 고정, rustup 이 처음에 받는다).

## 포트

| | HTTP | gRPC | 확인용(`verify-local`, +100) |
|---|---|---|---|
| notes (Node) | 8000 | | 8100 |
| activity (Spring) | 8001 | 9001 | 8101 · 9101 |
| tags (FastAPI) | 8002 | 9002 | 8102 · 9102 |
| templates (Go) | 8003 | | 8103 |
| web · admin · site · lite | 5280 · 5281 · 5282 · 5283 | | 5380 ~ 5383 |
| desktop (Tauri 개발 서버) | 1420 | | |
| Postgres (`pnpm infra`) | 5432 | | (같은 것을 쓰고 DB 만 `<서버>_test`) |

- 서버 포트는 `PORT` · `GRPC_PORT`, 바인딩은 `HOST`(기본 127.0.0.1, 컨테이너는 0.0.0.0)로 바꾼다.
  앱의 프록시가 넘길 서버는 `<서버>_URL`(`NOTES_URL` · `TAGS_URL` · `ACTIVITY_URL` · `TEMPLATES_URL`, 기본 `http://127.0.0.1:<그 서버의 포트>`.
  vite 는 dev 때, nginx 는 컨테이너가 뜰 때, site 는 rewrites 가 빌드 때 · 서버 컴포넌트가 실행할 때 읽는다). mobile 은 `EXPO_PUBLIC_NOTES_URL`,
  desktop 은 `http://127.0.0.1:8000` 고정(`src-tauri/capabilities/default.json` 의 허용 목록과 같이 바꾼다).
  notes 가 부르는 서버는 `TAGS_GRPC` · `ACTIVITY_GRPC`(기본 `http://127.0.0.1:9002` · `:9001`).
- 에이전트는 사용자가 띄운 개발 서버를 끄거나 거기에 요청하지 않는다. 확인은 +100 포트 · 테스트 DB(`<서버>_test`)로 따로 띄우고,
  끌 때는 그 포트의 PID · 자기가 띄운 컨테이너만 끈다 (`pkill -f` 금지: 같은 명령줄의 다른 프로젝트 서버까지 꺼진다).
  Postgres 는 사용자의 개발 DB 도 들어 있으니 `down -v` 로 지우지 않는다(사용자가 말할 때만).

## 환경 변수

`.env` 는 서버마다 선택 (`servers/<서버>/.env.template` 참고, activity 는 `.env` 를 읽지 않아 환경 변수로만). `HOST` · `PORT` · `GRPC_PORT`, DB 는 libpq 와 같은 `PGHOST` · `PGPORT` ·
`PGDATABASE` · `PGUSER` · `PGPASSWORD` (기본: `pnpm infra` 의 127.0.0.1:5432, DB = 서버 이름, app/app). 테스트는 `PGDATABASE` 만 `<서버>_test` 로 바꾼다.

## 인프라 (docker/)

```
docker/
├── docker-compose.middleware.yaml   # 서버가 쓰는 인프라 (Postgres). pnpm infra, 테스트 · CI 도 이것
├── docker-compose.yaml              # 전체 스택: 위 파일 include + 서버 · 웹 앱 이미지. pnpm stack
├── postgres/init.sql                # 서버마다 DB · 테스트 DB 를 만든다 (볼륨을 처음 만들 때만)
├── smoke.sh                         # 전체 스택이 뜬 뒤 notes → tags · activity 흐름, templates, 웹 앱의 화면 · /api/<서버> 프록시. 서버 · 앱마다 한 덩어리
└── .env.example                     # docker/.env 로 복사해 포트를 바꾼다 (POSTGRES_PORT · NOTES_PORT …)
```

- 두 파일의 compose 프로젝트 이름(`name:`)이 같아서 같은 Postgres 를 쓴다. 데이터는 볼륨 `<프로젝트 이름>_db`(기본 `initializer-stack_db`)에 남는다.
  처음부터 다시 만들기 · 다른 DB 로 바꾸기는 [guides/database.md](guides/database.md).
- 전체 스택은 서버의 HTTP, 웹 앱, Postgres 만 이 맥(127.0.0.1)에 연다. 서버끼리는 compose 네트워크 안에서 gRPC 로 부른다(notes → `tags:9002` · `activity:9001`).
  개발 서버와 같이 띄우려면 `NOTES_PORT` · `WEB_PORT` 등을 다르게 (`docker/.env.example`).
- 5432 가 이미 쓰이면 `docker/.env` 에 `POSTGRES_PORT`, 서버 · 테스트에는 같은 값으로 `PGPORT`.

## 이미지

- 서버 · 웹 앱마다 `Dockerfile` (mobile · desktop 은 네이티브 빌드라 없다). 컨텍스트는 그 폴더이고, 저장소 루트의 공유 파일
  (lockfile · `contract/` · `@app/client` · `tsconfig.base.json`)은 이름 붙인 컨텍스트 `workspace` 에서 `COPY --from=workspace` 로 받는다.
  BuildKit 은 COPY 한 경로만 보내서 저장소 전체가 넘어가지 않는다. templates 는 공유 파일이 필요 없어 그 폴더만 쓴다.
- 하나만: 그 폴더에서 `docker build --build-context workspace=../.. .` (앱은 `../../..`). compose 는 `additional_contexts`.
- 단계를 나눠 실행 이미지에는 실행에 쓰는 것만(dev 의존성 · 빌드 도구 · 캐시 없음), 실행 사용자는 root 가 아니다.
- 폴더를 통째로 COPY 하는 이미지는 그 폴더에 `.dockerignore` (activity: build · .gradle, tags: `__pycache__`, templates: tests · .env). 나머지는 경로를 골라 COPY 한다
  (`node_modules` 를 넘기면 이미지 안에서 설치한 것을 덮는다).
- web · admin · lite: `dist` + nginx(앱 폴더의 `nginx.conf.template`, 그 앱이 부르는 서버만), `/api/<서버>` → `<서버>_URL`(실행할 때),
  표에 없는 `/api` 는 JSON 404. 기본값은 Dockerfile 의 `ENV <서버>_URL=http://<서버>:<포트>`(compose 의 서비스 이름).
  site: standalone, rewrites 의 `NOTES_URL` 은 빌드 인자 · 서버 컴포넌트는 실행할 때(기본 `http://notes:8000`).
- compose 의 앱 서비스는 그 앱이 부르는 서버를 `depends_on` 에 둔다. notes 는 tags · activity 를 둔다.

## CI (.github/)

`workflows/ci.yml` 의 job 하나(`CI`)가 PR · main push · merge queue 마다 루트 명령을 차례로 돌린다. 명령이 로컬과 같아서 실패하면 같은 명령을 로컬에서 돌려 본다.

```
pnpm install → proto 호환 → 템플릿 스크립트 목록(rename · drop --check) → pnpm infra → pnpm typecheck(gen 포함) → 생성물이 커밋과 같은가 → pnpm lint → pnpm -r test
```

- 브랜치 보호의 필수 검사는 `CI` 하나다. 서버 · 앱을 더하거나 빼도 워크플로를 고치지 않는다.
- proto 호환(`buf breaking`)은 PR 의 대상 브랜치 커밋, merge queue 의 기준 커밋, main push 의 직전 커밋과 비교한다. 첫 push · force push 처럼 비교할 커밋이 없으면 이 검사만 건너뛴다.
- 전체 스택(이미지 · smoke)은 CI 에서 돌리지 않는다. 이미지 · 네트워크를 바꿨으면 로컬에서 `pnpm stack`.
- 생성물이 다르다고 실패하면 로컬에서 `pnpm gen` 을 돌려 함께 커밋한다.
- PR 은 `.github/pull_request_template.md` 의 확인 목록을 채운다. 한 PR 에는 한 작업만.
- 같은 PR 의 이전 실행은 취소한다(concurrency). 권한은 `contents: read` 만.
- 워크플로를 바꾸면 `actionlint` 로 확인한다 (`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`, git 저장소 안에서).

## 의존성 설치

- 설치 스크립트는 기본으로 막혀 있다(pnpm 12, 막힌 것이 있으면 `pnpm install` 이 실패한다). 스크립트 없이 동작하는지 확인한 것만
  `pnpm-workspace.yaml` 의 `allowBuilds` 에서 `false` 로 끄고 이유를 주석에 쓴다. 꼭 돌려야 하는 것만 `true`.
- pnpm 은 나온 지 하루가 안 된 버전을 설치하지 않는다(`minimumReleaseAge`). 막히면 예외(`minimumReleaseAgeExclude`)를 두지 않고
  범위의 아래 끝을 그 전 버전으로 낮춘 뒤(예: `~58.0.14` → `~58.0.12`), 하루가 지나면 `pnpm update`. lockfile 에 이미 막힌 버전이 있으면
  pnpm 이 lockfile 을 거부하니 `pnpm-lock.yaml` 을 지우고 `pnpm install` 로 다시 만든다 (범위 안에서만 바뀐다).
- `pnpm-workspace.yaml` 을 통째로 다시 쓰면 pnpm 이 넣은 항목이 사라진다. 고칠 때는 덧붙인다.

## 이름 바꾸기

템플릿으로 저장소를 만든 뒤 한 번 `pnpm rename "<표시 이름>" [slug]`. 템플릿 이름 `iStack`(README · AGENTS · DESIGN 제목, 앱 title ·
Tauri 창 · Expo 앱 이름)과 slug `initializer-stack`(루트 package.json · compose 프로젝트, Expo slug `<slug>-mobile`, Tauri identifier
`<slug>.desktop`)을 바꾸고 스크립트는 스스로 지워진다. slug 를 생략하면 표시 이름에서 만든다(`My Shop` → `my-shop`, 영문이 아니면 slug 를 준다).

- 저장소 안에서만 쓰는 이름은 그대로 둔다: `@app/*` scope, Java 패키지 `app`, Postgres 계정 `app`. 밖에 보이지 않아 프로젝트 이름과 달라도 된다.
- proto 패키지 `app.tag.v1` · `app.activity.v1` 은 gRPC 경로(`/app.tag.v1.TagService/Suggest`)로 밖에 보인다. 다른 저장소와 proto 를 나눠 쓰게 되면 첫 배포 전에
  바꾼다: `contract/proto/<이름>/` 로 옮기고 `package` · 각 서버의 import · gRPC 테스트 이름을 고친 뒤 `pnpm gen`.
- 템플릿에 보이는 이름을 더하면 `scripts/rename.mjs` 의 목록에도 더한다. CI 가 `--check` 로 목록이 파일과 맞는지 본다.
  템플릿 이름 자체를 바꿀 때는 목록의 곳을 모두 고친 뒤 스크립트의 `FROM` 한 줄.

## 예시 빼기

쓰지 않는 예시 서버 · 앱은 `pnpm drop <이름...>` 으로 뺀다(예: `pnpm drop site lite mobile`). 폴더와 함께 그것을 가리키는 설정 줄을 지운다:
루트 `gen` · `dev`, `contract/index.ts` · `contract/openapi/<서버>.*`, `docker/postgres/init.sql`, compose 서비스, `smoke.sh` 의 덩어리, `docker/.env.example` 의 포트.
끝나면 `pnpm install` 로 lockfile 을 정리한다.

- 남는 것이 부르는 서버는 빼지 않는다: 앱은 `<서버>.paths`(`createClient<서버.paths>`), 서버는 `<서버>_GRPC` 로 찾는다. tags · activity 는 notes · admin 이,
  templates 는 web · admin 이 부르니 함께 빼거나 그 호출을 고친 뒤 다시 돌린다. 호출을 고칠 때 그 앱의 프록시(vite · nginx · Dockerfile 의 `<서버>_URL`) ·
  compose 의 `depends_on` 도 같이 지운다(없는 서버를 가리키면 nginx · compose 가 뜨지 않는다).
- 문서(README · docs · AGENTS.md)의 설명은 고치지 않고, 남은 언급이 있는 파일을 알려 준다. ADR 은 기록이라 그대로 둔다.
- 템플릿에 서버 · 앱을 더하면 `scripts/drop.mjs` 의 목록에도 더한다. CI 가 `--check` 로 지울 줄이 파일에 있는지 본다.
