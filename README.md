<div align="center">

<a href="https://stack.initializer.org"><img src="https://stack.initializer.org/banner.png" alt="iStack — 여러 언어의 서버 · 클라이언트를 계약 하나로 잇는 모노레포 템플릿" /></a>

<a href="https://stack.initializer.org">문서</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="https://stack.initializer.org/reference/decisions/">설계 결정</a>
<span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
<a href="AGENTS.md">에이전트 지시</a>

<p>
  <a href="https://github.com/initializer-stack/template/actions/workflows/ci.yml"><img src="https://github.com/initializer-stack/template/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0" /></a>
</p>

</div>

<hr />

## 서버는 어떤 언어로든, 연결은 계약으로

서버와 클라이언트는 언어 · 프레임워크가 달라도 됩니다. 서로를 잇는 것은 `contract/` 하나뿐입니다.
클라이언트 ↔ 서버는 각 서버가 코드에서 만든 OpenAPI 로, 서버 ↔ 서버는 공통 proto 의 gRPC 로 통신합니다.

- **계약이 어긋나지 않습니다.** 서버 코드가 기준입니다. `pnpm gen` 이 OpenAPI 문서와 TypeScript 타입을 만들고,
  커밋된 생성물이 코드와 다르면 CI 가 막습니다. proto 의 호환은 `buf breaking` 으로 확인합니다.
- **서버는 맡은 일로 나뉘고 함께 움직입니다.** 메모를 저장하면 notes(Node)가 tags(FastAPI)에 태그를 묻고 activity(Spring)에 기록을 남깁니다.
  언어가 달라도 같은 레이어(api → domain → storage · clients)와 같은 오류 형식(`{ "error" }`)으로 구현합니다. 앱은 부르는 서버를 자기 프록시로 바로 부릅니다.
- **테스트는 실제 인프라에서 돕니다.** 실제 서버를 랜덤 포트로 띄워 docker 의 Postgres 에 붙이고 HTTP · gRPC 로 부릅니다.
  외부 서비스만 Fake 로 바꾸고, 전체 스택은 이미지로 띄워 smoke 로 확인합니다.
- **에이전트와 같이 일합니다.** `AGENTS.md`(`CLAUDE.md` 는 링크) · skills · hook 이 계약과 테스트 규칙을 지키게 합니다.

### 들어 있는 것

- **서버:** notes(메모, Node 24 · zod · Connect-ES), tags(태그, FastAPI · uv · pyrefly), activity(활동 기록, Spring Boot 4.1 · Java 25), templates(메모 템플릿, Go · Huma · pgx · goose)
- **클라이언트:** web(React) · admin(Vue) · site(Next) · lite(순수 TS), mobile(Expo), desktop(Tauri). 모두 `@app/client` 로 서버를 부릅니다.
- **인프라 · CI:** `docker/` 의 Postgres 와 전체 스택 compose, 서버 · 웹 앱 Dockerfile, 로컬과 같은 명령을 돌리는 GitHub Actions

## 시작하기

필요한 도구는 Node 24 · pnpm 12 · Docker · Java 25(activity) · uv(tags) · Go 1.25(templates) 입니다. desktop 은 Rust 가 더 필요합니다.

```bash
pnpm install
pnpm dev      # Postgres(docker) → 서버 넷 + web 앱, http://localhost:5280
pnpm test     # 모든 서버의 테스트
pnpm stack    # 서버 · 웹 앱 이미지로 전체 스택을 띄우고 smoke
```

템플릿으로 저장소를 만들었다면 `pnpm rename "프로젝트 이름"` 으로 보이는 이름을 바꾸고(스크립트는 끝나면 지워집니다)
`pnpm drop site lite …` 로 쓰지 않는 예시 앱을 뺍니다. 남긴 서버 · 앱이 내 프로젝트에서 맡을 일이 다르면 [이름부터 바꿉니다](docs/guides/add-server.md#이름을-바꿀-때). 그다음 이 README 를 프로젝트에 맞게 고치고, 브랜치 보호의 필수 검사에 `CI` 를 겁니다.

## 이슈 · 보안

- **버그 · 제안:** GitHub Issues 에 남겨 주세요.
- **보안 취약점:** 공개 이슈 대신 Security 탭의 "Report a vulnerability" 로 비공개 제보해 주세요.

## License

[Apache License 2.0](LICENSE) 으로 배포합니다.
