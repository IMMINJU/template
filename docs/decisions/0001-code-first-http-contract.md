# 0001. HTTP API 계약은 서버 코드가 기준, 문서는 서버마다 따로

- 상태: 채택
- 날짜: 2026-10-17
- 관련: `contract/openapi/`, `contract/index.ts`, `clients/packages/client`, `docs/contracts.md`

## 맥락

처음에는 손으로 쓴 `openapi.yaml` 하나에서 서버 · 클라이언트 타입을 만들었다(contract-first). Node 는 생성 타입으로
컴파일 때 맞춰졌지만 Spring 은 손으로 맞춰야 해서 문서와 서버가 어긋날 수 있었다. 서버는 언어가 여럿이고 API 도
서버마다 따로 자란다. 서버끼리 `Note` · `/api/note` 처럼 같은 이름이 나온다.

## 결정

- 서버가 자기 코드에서 openapi 문서를 만든다: notes(Node) = zod 스키마(검증과 같은 것), activity(Spring) = springdoc(테스트 의존성,
  실제 서버를 랜덤 포트로 띄워 받음), tags(FastAPI) = FastAPI(검증 실패 400 으로 문서도 고침). `pnpm gen` 이 `contract/openapi/<서버>.json` 에 쓴다.
- 클라이언트 타입은 그 문서에서 만든다(openapi-typescript → `<서버>.ts`). 손으로 쓰는 계약 문서는 두지 않는다.
- 문서는 서버마다 따로 두고 하나로 합치지 않는다. TS 에서는 서버별 네임스페이스(`notes.paths`)로 갈린다.
- 한 서버 안에서는 경로 · 스키마 이름 · operationId 가 유일해야 한다.
- 생성물은 커밋한다. 직접 고치지 않는다(hook 이 막는다). CI 는 `pnpm gen && git diff --exit-code contract/`.

## 결과

- 문서를 따로 손으로 관리하는 중복을 줄이고, 생성된 타입과 클라이언트 코드가 어긋나면 typecheck 에서 걸린다(필드 이름을 바꿔 web · mobile · desktop 이 모두 깨지는 것을 확인).
- 실제 응답의 런타임 검증과 배포된 옛 클라이언트의 호환은 별도다. 보장 범위는 `docs/contracts.md`.
- `pnpm typecheck` 가 gen 을 먼저 돌려 Java · uv 가 필요하고 몇 초 더 걸린다.
- 같은 API 를 여러 서버가 구현해도 서로 같은지는 보장하지 않는다. 필요하면 네임스페이스끼리 타입 동등성 검사를 둔다.
- Spring(springdoc)은 같은 단순 클래스명이 문서에서 조용히 덮어써진다. 이름 규칙으로 막는다(`servers/activity/AGENTS.md`).
- 게이트웨이용으로 합쳐야 하면 합칠 때 서버 이름을 접두사로 붙인다.
