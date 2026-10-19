# 관리 앱 (Vue)

태그 규칙 · 템플릿을 관리하고 활동 기록을 본다. Vite + Vue 3 SFC + TanStack Query (:5281). 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
index.html               # 진입 HTML
src/
├── main.ts              # 진입점: VueQueryPlugin · style.css
├── App.vue              # 관리 화면: 태그 규칙(목록 · 추가 · 삭제) · 템플릿(목록 · 추가 · 수정 · 삭제) · 활동 기록(최근 것부터)
└── style.css            # 색 토큰(라이트/다크) · 화면 스타일
vite.config.ts           # 개발 서버 :5281 · /api/tags · /api/activity · /api/templates 프록시
package.json · tsconfig.json
nginx.conf.template      # 이미지의 nginx: vite 프록시와 같은 표, 표에 없는 /api 는 JSON 404
Dockerfile               # 이미지: dist 를 nginx 로. 서버 주소는 실행할 때 TAGS_URL · ACTIVITY_URL · TEMPLATES_URL (기본 http://<서버>:<포트>)
```

## 명령

```bash
pnpm dev · build · typecheck · lint · format   # vite (:5281) · vite build · vue-tsc -p . · oxlint · oxfmt
docker build --build-context workspace=../../.. .   # 이미지 (이 폴더에서)
```

## 규칙

- 서버: tags · activity · templates 셋. 서버마다 `createClient<서버.paths>({ name: '서버' })` (같은 출처).
  vite 프록시(이미지는 nginx)가 `/api/tags` 를 `TAGS_URL`(기본 :8002), `/api/activity` 를 `ACTIVITY_URL`(:8001), `/api/templates` 를 `TEMPLATES_URL`(:8003)로 넘긴다.
  notes 는 부르지 않는다. 부르는 서버를 바꾸면 `vite.config.ts` · `nginx.conf.template` · `Dockerfile` 의 `ENV` · compose 의 `depends_on` 을 같이 고친다.
- 화면은 `useQuery(api.query(경로))`, 규칙 추가 · 삭제는 `useMutation` 뒤 `invalidateQueries({ queryKey: tagsApi.query('/api/tags/rules').queryKey })`.
  활동 기록은 읽기만 한다(쓰는 것은 notes 가 gRPC 로).
- 템플릿 카드는 `수정` 을 누르면 아래 칸에 불러와 `PUT /api/templates/{id}`, 고르지 않았으면 `POST /api/templates`. 저장 · 삭제 뒤 템플릿 목록을 다시 받는다.
- 타입체크는 `vue-tsc` 라 이 앱은 TS 6(`catalog:ts6`)이다. vue-tsc 는 TS 의 JS API 를 쓰는데 TS 7 에는 아직 없다.
- 템플릿에서 `v-html` 은 쓰지 않는다(`{{ }}` 만). vue-query 가 쓰는 vue-demi 의 설치 스크립트는 꺼져 있다(기본 파일이 Vue 3 용).
