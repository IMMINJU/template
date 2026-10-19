# 가벼운 웹 앱 (순수 TS)

프레임워크 없는 메모 앱. Vite (:5283). 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
index.html               # 진입 HTML
src/
├── main.ts              # 메모 화면: api.get · post · delete 뒤 목록(태그 칩)을 다시 그린다
├── main.css             # 메모 화면만 쓰는 스타일 (목록 · 태그 칩 · 추가 칸)
└── style.css            # 색 토큰(라이트/다크) · 여러 화면이 함께 쓰는 스타일
vite.config.ts           # 개발 서버 :5283 · /api/notes 프록시
package.json · tsconfig.json
nginx.conf.template      # 이미지의 nginx: vite 프록시와 같은 표, 표에 없는 /api 는 JSON 404
Dockerfile               # 이미지: dist 를 nginx 로. notes 주소는 실행할 때 NOTES_URL (기본 http://notes:8000)
```

## 명령

```bash
pnpm dev · build · typecheck · lint · format   # vite (:5283) · vite build · tsc -p . (TS 7) · oxlint · oxfmt
docker build --build-context workspace=../../.. .   # 이미지 (이 폴더에서)
```

## 규칙

- 서버: notes 하나. `createClient<notes.paths>()` (같은 출처). vite 프록시(이미지는 nginx)가 `/api/notes` 를 `NOTES_URL`(기본 :8000)로 넘긴다.
  부르는 서버를 바꾸면 `vite.config.ts` · `nginx.conf.template` · `Dockerfile` 의 `ENV` · compose 의 `depends_on` 을 같이 고친다.
- 프레임워크가 없어 `api.get` · `api.post` · `api.delete` 를 그대로 쓰고, 쓴 뒤 목록을 다시 받는다. 화면 문자열(메모 · 태그)은 `textContent` 로만 넣는다.
- 스타일: 전역 `src/style.css` 는 색 토큰(라이트/다크)과 여러 화면이 함께 쓰는 것(지금은 카드 · 입력칸 · 버튼 · 머리글)만.
  한 컴포넌트만 쓰는 스타일은 옆의 `Component.css` 에 두고 그 컴포넌트에서 import 한다. 엔트리는 `style.css` 를 먼저 import.
