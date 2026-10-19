---
name: verify-local
description: 바꾼 서버 · 앱을 사용자의 개발 서버와 겹치지 않는 포트 · 테스트 DB 로 따로 띄워, 실제 HTTP · gRPC 응답과 화면으로 변경이 맞는지 증거를 남긴다. 서버 · 계약 · 클라이언트를 바꾼 뒤 확인할 때, 사용자가 실제로 확인해 달라거나 /verify-local·$verify-local 을 부를 때 쓴다. 앱을 띄워 보는 /run 도 이 방법을 따른다.
---

# 로컬 확인

증거는 실제 응답(curl · gRPC 호출)과 스크린숏이다. 테스트가 통과했다는 것만으로 실제로 된다고 하지 않는다.

## 안전

- 사용자의 개발 서버는 건드리지 않는다: notes 8000, activity 8001 · 9001, tags 8002 · 9002, templates 8003, 앱 5280~5283(web · admin · site · lite).
  확인용은 **포트 +100**(notes 8100, activity 8101 · 9101, tags 8102 · 9102, templates 8103, 앱 5380~5383)과 테스트 DB(`<서버>_test`)로 따로 띄운다.
- Postgres(`pnpm infra`)는 같이 쓴다. 사용자의 개발 DB 가 들어 있으니 끄거나 `down -v` 하지 않는다 (처음부터 떠 있지 않았으면 끝나고 `pnpm infra:down`).
- 끌 때는 **그 포트에서 LISTEN 중인 PID 만** 끈다. `pkill -f '<명령>'` 은 쓰지 않는다: 같은 명령줄로 도는
  다른 프로젝트 서버까지 꺼진다.
- 띄우기 전에 포트가 비었는지 본다: `lsof -nP -iTCP:8100 -sTCP:LISTEN`.

## 1. 서버 띄우기

바꾼 서버와 그 서버가 부르는 서버를, 저장소 루트에서 백그라운드로. Postgres 가 없으면 먼저 `pnpm infra`.
notes 는 메모를 쓸 때 tags · activity 를 부르니 확인용 notes 는 확인용 tags · activity(+100)에 붙인다.

```bash
(cd servers/tags && PGDATABASE=tags_test GRPC_PORT=9102 uv run uvicorn server.main:app --host 127.0.0.1 --port 8102 > /tmp/verify-tags.log 2>&1 &)
(cd servers/activity && PGDATABASE=activity_test PORT=8101 GRPC_PORT=9101 ./gradlew :core:core-api:bootRun > /tmp/verify-activity.log 2>&1 &)
(cd servers/notes && PGDATABASE=notes_test PORT=8100 TAGS_GRPC=http://127.0.0.1:9102 ACTIVITY_GRPC=http://127.0.0.1:9101 \
  node src/main.ts > /tmp/verify-notes.log 2>&1 &)
(cd servers/templates && PGDATABASE=templates_test PORT=8103 go run . > /tmp/verify-templates.log 2>&1 &)
for u in 8100/api/notes 8101/api/activity 8102/api/tags/rules 8103/api/templates; do
  for i in $(seq 1 60); do curl -sf -o /dev/null 127.0.0.1:$u && break; sleep 1; done
done
```

이미지 · compose 를 바꿨으면 전체 스택을 **다른 compose 프로젝트**로 띄운다. Postgres · 볼륨 · 네트워크가 따로라
사용자의 개발 DB 에 smoke 가 쓰지 않는다 (smoke.sh 까지 돈다):

```bash
export COMPOSE_PROJECT_NAME=app-verify POSTGRES_PORT=5532 NOTES_PORT=8100 ACTIVITY_PORT=8101 TAGS_PORT=8102 TEMPLATES_PORT=8103 \
  WEB_PORT=5380 ADMIN_PORT=5381 SITE_PORT=5382 LITE_PORT=5383
pnpm stack
docker compose -f docker/docker-compose.yaml down -v --rmi local   # 끝나면 이 프로젝트만 통째로 (같은 셸에서)
```

## 2. 서버 확인

HTTP 계약과 서버끼리의 흐름 (tags_test 는 테스트가 비우니 규칙부터 하나 만든다):

```bash
J='content-type: application/json'; N=127.0.0.1:8100/api/notes; R=127.0.0.1:8102/api/tags/rules
curl -s -X POST -H "$J" -d '{"keyword":"회의","tag":"회의"}' $R   # 201 {"id":<rule>,"keyword":"회의","tag":"회의"}
curl -s -X POST -H "$J" -d '{"text":"내일 회의"}' $N         # 201 {"id":<id>,"text":"내일 회의","tags":["회의"]} — 아래 <id> 는 이 값
curl -s 127.0.0.1:8101/api/activity                          # {"activities":[{"action":"note.created","noteId":<id>,...}]}
curl -s -X PUT -H "$J" -d '{"text":"점심"}' $N/<id>          # {"id":<id>,"text":"점심","tags":[]}
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $N/<id>    # 204
curl -s $N/<id>                                              # 404 {"error":"메모가 없습니다"}
curl -s $N/abc                                               # 400 {"error"}
curl -s -X POST -H "$J" -d '{"text":1}' $N                   # 400 {"error"}
curl -s -X POST -d 'text=hi' $N                              # 400 JSON 본문이 필요합니다
curl -s -X POST -H "$J" -d '{"name":"회의록","body":"회의"}' 127.0.0.1:8103/api/templates   # 201 {"id":<t>,"name":"회의록","body":"회의"}
```

tags 를 끄고 POST 하면 502 `{"error":"태그 서버에 연결할 수 없습니다"}` 이고 저장되지 않는다. activity 를 끄면 201 이고 notes 로그에 경고만 남는다.

gRPC 를 직접 부를 때:

```bash
(cd contract && pnpm exec buf curl --protocol grpc --http2-prior-knowledge --schema proto \
  http://127.0.0.1:9102/app.tag.v1.TagService/Suggest -d '{"text": "회의"}')        # {"tags":["회의"]}
(cd contract && pnpm exec buf curl --protocol grpc --http2-prior-knowledge --schema proto \
  http://127.0.0.1:9101/app.activity.v1.ActivityService/Record -d '{"action": ""}')  # invalid_argument
```

## 3. 앱 확인

앱은 부르는 서버마다 `<서버>_URL` 로 확인용 서버(+100)에 붙인다. 앱의 프록시가 경로로 서버를 고른다.

```bash
NOTES_URL=http://127.0.0.1:8100 TEMPLATES_URL=http://127.0.0.1:8103 pnpm --filter @app/web exec vite --port 5380 --strictPort   # lite(5383) 는 NOTES_URL 만
TAGS_URL=http://127.0.0.1:8102 ACTIVITY_URL=http://127.0.0.1:8101 TEMPLATES_URL=http://127.0.0.1:8103 \
  pnpm --filter @app/admin exec vite --port 5381 --strictPort
NOTES_URL=http://127.0.0.1:8100 pnpm --filter @app/site build                                # rewrites 는 빌드 때 정해진다
(cd clients/apps/site && NOTES_URL=http://127.0.0.1:8100 pnpm exec next start -p 5382 &)
curl -s localhost:5382/ | grep '회의'                                                        # 서버에서 미리 받아 HTML 에 담겼나
```

- 화면은 Chrome 헤드리스로 확인한다. 셋을 다 본다 (테스트 · 빌드가 통과해도 브라우저에서만 깨지는 것이 있다:
  react · react-dom 버전이 어긋나면 web 화면이 비고 콘솔에만 오류가 난다).

  ```bash
  C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "$C" --headless --screenshot=/tmp/verify.png --window-size=1440,900 --virtual-time-budget=5000 http://localhost:5380  # Read 로 본다. 모바일 폭은 390,844
  "$C" --headless --dump-dom --virtual-time-budget=5000 http://localhost:5380 | grep -o '<main>.*</main>'               # 그려진 DOM
  "$C" --headless --dump-dom --virtual-time-budget=5000 --enable-logging=stderr --v=0 http://localhost:5380 2>&1 >/dev/null | grep CONSOLE  # 콘솔 오류 (없어야 한다)
  ```

  덤프는 속성만 보인다 (`textarea.value` 처럼 DOM 값으로 넣은 것은 안 보인다). 헤드리스 Chrome 은 다크 모드다.
  `CVDisplayLink` 같은 줄은 Chrome 자체 로그라 무시한다.
- mobile 은 `npx expo export --platform ios` 로 번들까지, desktop 은 `pnpm exec tauri build --debug --no-bundle` 로 빌드까지만.
  시뮬레이터 · 창은 화면에 뜨므로 사용자가 말할 때만 띄운다.

## 4. 정리

전체 스택을 띄웠으면 먼저 그 compose `down` (그때 8100~8102 · 5380~5383 을 잡은 PID 는 Docker 자체라 kill 하지 않는다).

```bash
for port in 8100 8101 9101 8102 9102 8103 5380 5381 5382 5383; do pid=$(lsof -tnP -iTCP:$port -sTCP:LISTEN); [ -n "$pid" ] && kill $pid; done
rm -rf clients/apps/site/.next clients/apps/site/next-env.d.ts clients/apps/site/tsconfig.tsbuildinfo
find clients/apps -maxdepth 2 -name dist -type d -prune -exec rm -rf {} +   # zsh 는 맞는 파일이 없는 * 에서 명령 전체를 멈춘다
```

`/tmp` 스크립트 · 로그는 지운다. 스크린숏은 보고에 경로를 적고 남긴다.

## 보고

- 띄운 서버 · 앱과 포트, 보낸 요청과 기대값 · 실제값.
- 스크린숏 경로, 서버 로그 · 콘솔 오류(없으면 없음).
- 보지 못한 것(띄우지 않은 시뮬레이터 · 창 등)은 따로 적는다.
