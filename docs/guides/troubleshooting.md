# 자주 겪는 문제

설치 · 실행 · 테스트 중 자주 겪는 문제를 증상 · 원인 · 해결로 적는다.

## web(React) 화면이 비어 있다

- **증상**: 테스트 · 빌드는 통과하는데 브라우저에서 web 이 빈 화면이고 콘솔에만 오류가 난다.
- **원인**: `react` 와 `react-dom` 버전이 다르다. `^` 범위로 두면 pnpm 이 둘을 따로 고를 수 있다.
- **해결**: `pnpm-workspace.yaml` 카탈로그에서 두 패키지를 Expo 가 정한 같은 버전으로 고정한다. 올릴 때도 카탈로그에서 함께 바꾼다.

## site(Next)가 엉뚱한 서버를 부른다

- **증상**: `NOTES_URL` 을 바꿔 띄웠는데 브라우저의 `/api/notes` 요청이 예전 서버로 간다.
- **원인**: `next.config.ts` 의 rewrites 주소는 `next build` 때 정해진다. `NOTES_URL` 을 실행할 때 읽는 것은 서버 컴포넌트(`app/api.ts`)뿐이다.
- **해결**: 빌드할 때 준다: `NOTES_URL=http://127.0.0.1:8100 pnpm --filter @app/site build`. 이미지는 빌드 인자 `NOTES_URL`.

## 앱의 요청이 502 나 프록시 오류로 실패한다

- **증상**: 화면에 `API 오류 (HTTP 502)` 가 뜨고, 개발 서버(vite) 로그에 `http proxy error: /api/notes` 와 `ECONNREFUSED 127.0.0.1:8000` 이 난다.
- **원인**: 앱은 부르는 서버마다 자기 프록시(vite · nginx · Next)로 바로 넘긴다. 그 서버가 떠 있지 않으면 프록시가 JSON 이 아닌 오류(vite · nginx 는 502)를 주고,
  클라이언트는 `{ error }` 가 없으니 상태 코드만 보여 준다. 앱만 따로 띄우면(`pnpm --filter @app/web dev`) 이렇게 된다.
  `태그 서버에 연결할 수 없습니다` 처럼 서버의 문장이 보이면 앱이 부른 서버는 떠 있고, 그 서버가 부르는 서버(notes → tags)가 없다.
- **해결**: 루트 `pnpm dev` 로 서버 넷(notes · tags · activity · templates)을 같이 띄운다. 따로 띄운 서버에 붙일 때는 앱의 개발 서버에 그 서버의 `<서버>_URL`(`NOTES_URL` · `TEMPLATES_URL` …)을 준다.

## `pnpm install` 이 설치 스크립트 때문에 실패한다

- **증상**: `ERR_PNPM_IGNORED_BUILDS` 와 함께 설치가 멈춘다.
- **원인**: pnpm 12 는 의존성의 설치 스크립트를 기본으로 막고, 막힌 것이 있으면 실패한다.
- **해결**: [development.md](../development.md#의존성-설치) 처럼 `allowBuilds` 에 적는다.

## 테스트가 `ECONNREFUSED 127.0.0.1:5432` 로 실패한다

- **원인**: 테스트는 docker 의 Postgres 를 쓰는데 떠 있지 않다.
- **해결**: `pnpm infra`. 루트의 `pnpm test` · `pnpm dev` 는 먼저 띄우지만 `pnpm --filter` 로 하나만 돌릴 때는 직접 띄운다.

## 5432 포트가 이미 쓰이고 있다

- **원인**: 이 컴퓨터에 다른 Postgres 가 떠 있다.
- **해결**: `docker/.env.example` 을 `docker/.env` 로 복사해 `POSTGRES_PORT` 를 바꾸고, 서버 · 테스트에는 같은 값으로 `PGPORT` 를 준다.

## 이름을 바꾼 뒤 DB 가 비어 있다

- **원인**: `pnpm rename` 이 compose 프로젝트 이름을 바꿔서 Postgres 볼륨도 새 이름(`<slug>_db`)으로 만들어진다.
- **해결**: 템플릿 상태로 띄운 적이 있다면 예전 볼륨이 남아 있다. 필요 없으면 지운다: `docker volume rm initializer-stack_db`.

## 브랜치를 바꾼 뒤 서버가 마이그레이션 오류로 뜨지 않는다

- **증상**: 브랜치를 바꾸거나 main 을 받은 뒤 서버 · 테스트가 시작하다 멈춘다.
- **원인**: DB 의 적용 기록과 마이그레이션 파일이 다르다. 도구마다 멈추는 경우가 다르다:

  | 경우 | notes (node-pg-migrate) | activity (Flyway) | tags (Alembic) |
  |---|---|---|---|
  | 적용한 마이그레이션을 고쳤다 | 고친 내용을 무시하고 뜬다 | `Migration checksum mismatch for migration version 3` | 고친 내용을 무시하고 뜬다 |
  | main 에도 같은 번호가 생겼다 | main 의 것이 이름순으로 앞이면 `Not run migration 0003_a is preceding already run migration 0003_b` | `Found more than one migration with version 3` | `Multiple head revisions are present` |
  | 적용한 마이그레이션이 없는 브랜치로 왔다 | 뜬다 (만든 표는 남는다) | 뜬다 (만든 표는 남는다) | `Can't locate revision identified by '0003'` |

- **해결**:
  - 고쳤다: 되돌리고 바꿀 것을 새 번호로 더한다. notes · tags 도 같다. 오류는 없지만 이미 적용한 DB 에는 고친 내용이 들어가지 않아 DB 마다 스키마가 달라진다.
  - 번호가 겹쳤다: 내 것을 main 의 마지막 다음 번호로 바꾼다 (tags 는 `revision` · `down_revision` 도). 내 DB 에는 예전 번호가 기록돼 있으니
    그 서버의 개발 · 테스트 DB 를 다시 만든다 → [database.md](database.md#개발-db-를-처음부터).
  - 브랜치를 오갔다: 마이그레이션이 있는 브랜치로 돌아가면 그대로 쓴다. 이 브랜치에서 계속 쓰려면 그 서버의 DB 를 다시 만든다.

## admin 의 vue-tsc · site 의 next build 가 TypeScript 7 에서 돌지 않는다

- **원인**: 저장소 기본은 TypeScript 7 인데 vue-tsc 와 next build 는 TS 의 JS API 를 쓰고, TS 7 에는 아직 그 API 가 없다.
- **해결**: 그 앱만 `"typescript": "catalog:ts6"`.

## Expo 패키지를 설치할 수 없다

- **증상**: Expo 를 올리거나 `npx expo install --fix` 뒤 pnpm 이 너무 새 버전이라며 설치하지 않는다.
- **원인**: pnpm 은 나온 지 하루가 안 된 버전을 설치하지 않는다(`minimumReleaseAge`).
- **해결**: [development.md](../development.md#의존성-설치) 처럼 예외를 두지 않고 범위의 아래 끝을 그 전 버전으로 낮춘다.

## zsh 에서 정리 명령이 통째로 멈춘다

- **증상**: `rm -rf clients/apps/*/dist` 같은 명령이 `no matches found` 로 아무것도 하지 않는다.
- **원인**: zsh 는 맞는 파일이 없는 `*` 를 만나면 명령 전체를 멈춘다.
- **해결**: `find` 를 쓴다: `find clients/apps -maxdepth 2 -name dist -type d -prune -exec rm -rf {} +`.
