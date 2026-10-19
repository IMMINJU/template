# Tauri 데스크톱 앱

메모 앱. Tauri 2 (Vite + 순수 TS 창). 클라이언트 공통 규칙은 `docs/architecture.md` 의 "클라이언트", 이 파일이 이 앱에서는 우선한다.

## 구조

```
index.html               # 창(웹)의 진입 HTML
src/
├── main.ts              # 메모 화면(태그 칩 · 추가 · 삭제): tauri-plugin-http 의 fetch 로 notes 서버를 부른다
└── style.css            # 색 토큰(라이트/다크) · 화면 스타일
vite.config.ts           # 창의 개발 서버 :1420 (tauri.conf.json 의 devUrl)
src-tauri/               # Rust 쪽
├── src/main.rs          # 앱 시작: HTTP 플러그인 등록
├── tauri.conf.json      # 앱 이름 · identifier (pnpm rename 이 바꾼다) · 창 · devUrl
├── capabilities/default.json   # 창이 부를 수 있는 URL 허용 목록
├── icons/               # 앱 아이콘
├── Cargo.toml · Cargo.lock · build.rs
└── target/              # 빌드 캐시 (gitignore)
rust-toolchain.toml      # 이 앱의 Rust 버전
package.json · tsconfig.json
```

## 명령

```bash
pnpm start          # tauri dev (창이 뜬다, Vite :1420)
pnpm build          # tauri build (앱 번들)
pnpm exec tauri build --debug --no-bundle   # 창 없이 빌드만 확인
pnpm typecheck · lint · format
```

## 규칙

- 창이 `tauri://` 출처라 브라우저 fetch 는 CORS 에 막힌다. Rust 쪽 `tauri-plugin-http` 의 fetch 를
  `createClient<notes.paths>({ base: 'http://127.0.0.1:8000', fetch })` 로 넘긴다(notes 를 직접).
- 부를 수 있는 URL 은 `src-tauri/capabilities/default.json` 의 허용 목록이다(지금은 notes `http://127.0.0.1:8000/*` 하나). 서버 주소를 바꾸면 `src/main.ts` 와 같이 바꾼다.
- Rust 버전은 `rust-toolchain.toml` 로 이 앱에만 고정한다(Tauri 2.12 는 1.95+, rustup 이 처음에 받는다).
- 창은 화면에 뜨므로 사용자가 말할 때만 띄운다.
