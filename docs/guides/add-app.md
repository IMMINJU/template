# 앱 추가

이름은 누가 어디서 쓰는지로, 프레임워크는 무엇이든 된다. 예시 앱(web · React, admin · Vue, site · Next, lite · 순수 TS, mobile · Expo, desktop · Tauri) 중 가까운 것을 본뜨고 아래 연결 지점을 채운다.

## 1. 폴더와 의존성

`clients/apps/<이름>/` 에 `package.json` 을 둔다.

- 의존성 버전은 `"catalog:"`. 버전은 `pnpm-workspace.yaml` 의 카탈로그 한 곳에서 정한다.
  Expo 가 정하는 버전은 `catalog:expo`, TS 의 JS API 가 필요한 도구(admin 의 vue-tsc · site 의 next build)는 `catalog:ts6`.
- `react` · `react-dom` 은 저장소 전체가 정확히 같은 버전이다. 앱에서 따로 올리지 않는다.
- 스크립트는 `lint` · `format` · `typecheck`. lint · format 설정은 `clients/` 의 공통 설정을 그대로 쓴다.
- 개발 서버 포트는 [development.md](../development.md#포트) 의 표와 겹치지 않게 고른다.

## 2. 서버 부르기

부를 서버마다 클라이언트를 하나 만든다. 경로 · 응답 타입은 그 서버가 만든 문서에서 온다.

```ts
import { createClient, type notes } from '@app/client'

const api = createClient<notes.paths>({ name: 'notes' })
```

- 웹 앱은 같은 출처로 부른다. `base` 를 비우고, 부르는 서버마다 개발 서버의 프록시에 경로 하나를 둔다
  (예시 vite 앱은 `vite.config.ts` 의 `'/api/<서버>'` → `<서버 대문자>_URL ?? 'http://127.0.0.1:<포트>'`). 부르지 않는 서버는 적지 않는다.
- 네이티브 앱은 `base` 에 그 서버 주소를 준다(mobile 은 `EXPO_PUBLIC_NOTES_URL ?? 'http://127.0.0.1:8000'`, desktop 은 `http://127.0.0.1:8000` 과 `src-tauri/capabilities/default.json` 의 허용 URL).
  서버 렌더링은 서버에서 부를 때만 그 서버 주소다(site 의 `app/api.ts` 는 `NOTES_URL`, 브라우저에서는 같은 출처).
- 서버 데이터는 TanStack Query 에 `api.query(경로)` 를 넘긴다. 저장 뒤에는 그 `queryKey` 로 `invalidateQueries`.
- 화면은 [DESIGN.md](../../DESIGN.md) 의 토큰 · 규칙을 따른다.

→ [구조 · 클라이언트](../architecture.md#클라이언트)

## 3. 이미지 (웹 앱만)

- 정적 앱은 `clients/apps/web/Dockerfile` 과 그 옆의 `nginx.conf.template` 을 본뜬다. 빌드한 파일을 nginx 가 내주고, 부르는 서버마다 `location /api/<서버>` 를 `<서버 대문자>_URL` 로 넘긴다
  (기본값은 Dockerfile 의 `ENV <서버 대문자>_URL=http://<서버>:<포트>`). 표에 없는 `/api` 는 서버들과 같은 JSON 404 다.
- 서버 렌더링 앱은 `clients/apps/site/Dockerfile` 을 본뜬다(standalone 출력). `next.config.ts` 의 rewrites 주소는 빌드 때 정해지니 서버 주소를 빌드 인자(`ARG NOTES_URL`)로도 준다.
- `docker/docker-compose.yaml` 에 서비스를(`depends_on` 은 부르는 서버), `docker/smoke.sh` 에 그 앱의 덩어리(`# <이름>` 부터 빈 줄까지)를, `docker/.env.example` 에 포트 한 줄(`# <이름 대문자>_PORT=<포트>`)을 더한다.

mobile · desktop 처럼 네이티브로 빌드하는 앱은 이미지가 없다.

## 4. 지시 파일

`clients/apps/<이름>/AGENTS.md` 에 구조 · 명령 · 서버 부르는 방식을 쓰고 `ln -s AGENTS.md CLAUDE.md`.

## 이름을 바꿀 때

앱 이름은 누가 어디서 쓰는지다(`web` · `admin` · `site`). 프레임워크는 이름에 넣지 않는다. 바꾸는 순서는 [서버 추가의 "이름을 바꿀 때"](add-server.md#이름을-바꿀-때)와 같고,
앱 이름이 들어가는 곳은 더 적다: `@app/<이름>`, `clients/apps/<이름>`, `<이름 대문자>_PORT`, compose 서비스 · smoke 덩어리, `scripts/rename.mjs` · `scripts/drop.mjs` 의 목록.

```bash
n=web; N=WEB
git grep -n -E "@app/${n}|clients/apps/${n}|${N}_PORT|^  ${n}:|^# ${n}" -- ':!pnpm-lock.yaml' ':!*.md'
```

## 앱을 뺄 때

`pnpm drop <이름>` 이 폴더와 루트 `dev` 의 `--filter` · compose · smoke · 포트 줄을 지운다. → [development.md](../development.md#예시-빼기).
새 앱을 템플릿에 더했다면 `scripts/drop.mjs` 의 목록에도 더한다.
