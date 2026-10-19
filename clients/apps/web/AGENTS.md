# 웹 앱 (React)

메모를 쓰고(템플릿으로 시작할 수 있다) 태그를 본다. Vite + React 19 + TanStack Query (:5280). 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
index.html               # 진입 HTML
src/
├── main.tsx             # 진입점: QueryClientProvider 하나 · style.css
├── App.tsx              # 메모 화면: 목록(태그 칩) · 추가 · 삭제 · 템플릿 고르기. useQuery · useMutation
└── style.css            # 색 토큰(라이트/다크) · 화면 스타일
vite.config.ts           # 개발 서버 :5280 · /api/notes · /api/templates 프록시
package.json · tsconfig.json
nginx.conf.template      # 이미지의 nginx: vite 프록시와 같은 표, 표에 없는 /api 는 JSON 404
Dockerfile               # 이미지: dist 를 nginx 로. 서버 주소는 실행할 때 NOTES_URL · TEMPLATES_URL (기본 http://notes:8000 · http://templates:8003)
```

## 명령

```bash
pnpm dev · build · typecheck · lint · format   # vite (:5280) · vite build · tsc -p . (TS 7) · oxlint · oxfmt
docker build --build-context workspace=../../.. .   # 이미지 (이 폴더에서)
```

## 규칙

- 서버: notes 와 templates 둘. `createClient<notes.paths>({ name: 'notes' })` · `createClient<templates.paths>({ name: 'templates' })` (같은 출처).
  vite 프록시(이미지는 nginx)가 `/api/notes` 를 `NOTES_URL`(기본 :8000), `/api/templates` 를 `TEMPLATES_URL`(기본 :8003)로 넘긴다.
  부르는 서버를 바꾸면 `vite.config.ts` · `nginx.conf.template` · `Dockerfile` 의 `ENV` · compose 의 `depends_on` 을 같이 고친다.
- 화면은 `useQuery(api.query(경로))`, 만들기 · 지우기는 `useMutation` 뒤 `invalidateQueries({ queryKey: api.query('/api/notes').queryKey })`.
- 템플릿은 고르면 입력칸을 그 내용으로 채우기만 한다(저장은 메모로). templates 를 못 받으면 고르기만 숨기고 메모 쓰기는 그대로 둔다.
- 태그는 notes 가 저장할 때 붙여 돌려준다(tags 서버를 부르지 않는다). 화면은 DESIGN.md 의 Tag 칩으로만 보여 준다.
- `react` · `react-dom` 버전은 카탈로그가 정한다(정확히 같은 버전, `docs/architecture.md` 의 "클라이언트"). 이 앱에서 따로 올리지 않는다.
