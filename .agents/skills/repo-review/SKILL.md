---
name: repo-review
description: 브랜치 diff · 지정한 파일 · 붙여 넣은 diff 를 이 저장소 기준으로 리뷰한다. 계약(서버 코드 → openapi 생성물, proto 호환), ADR, 서버 레이어, 테스트 구조(specs · Fake), 이미 있는 것을 다시 만든 코드, 에이전트가 남긴 군더더기. 사용자가 우리 기준 리뷰나 /repo-review·$repo-review 를 부를 때만 쓴다. 구현만 하는 요청, 버그 찾기 · 보안 리뷰(/code-review · /security-review)에는 쓰지 않는다.
---

# 저장소 리뷰

규칙은 가까운 `AGENTS.md` 와 `docs/` 가 갖고, 이 skill 은 리뷰 절차만 갖는다. 규칙을 여기 다시 쓰지 않는다.

## 증거부터

1. 범위를 정한다: 지정한 파일, 아니면 `git fetch origin main && git diff origin/main` (안 되면 `main`) 과 작업 트리.
2. 바뀐 줄, 그 줄이 속한 서버 · 앱의 `AGENTS.md`, 루트 `AGENTS.md` 를 읽는다.
3. 아래 표에서 diff 에 맞는 문서만 더 읽는다. 호출하는 쪽 · 생성물 · 테스트는 결론이 거기에 달렸을 때만 따라간다.
4. 깨지는 동작, 어긴 규칙, 계약 위반처럼 짚을 수 있는 것만 지적한다. 규칙 위반이면 어느 문서의 어느 규칙인지 든다.

| diff 가 건드린 것 | 읽을 것 |
|---|---|
| 서버의 HTTP 라우트 · 모델 · gRPC, `contract/` | `docs/contracts.md`, ADR-0001 · 0002 |
| 서버의 레이어 · 오류 · 바인딩 | `docs/architecture.md`, 그 서버 `AGENTS.md` "규칙" |
| 테스트, 새 엔드포인트 · RPC | `docs/testing.md`, ADR-0003, 그 서버 `AGENTS.md` "테스트" |
| 클라이언트 앱 · `@app/client` · 카탈로그 | `docs/architecture.md` 의 "클라이언트", 그 앱 `AGENTS.md` |
| 스크립트 · 의존성 · `pnpm-workspace.yaml` · `docker/` · Dockerfile · `.github/` | `docs/development.md` |
| 서버 · 앱 추가 · 제거, DB 스키마 · 엔진 | `docs/guides/` 의 그 절차 |
| 코드 경로 · 명령 · 예시가 바뀜 | 그것을 인용한 `docs/guides/*.md` 가 따라 바뀌었나 |
| 기반 패턴을 바꿈 | `docs/decisions/README.md` 의 관련 ADR |

## 리뷰에서만 쓰는 판단

규칙 문서에 없는, 리뷰할 때 확인하는 방법이다.

- **계약**: API 가 바뀌었는데 `contract/openapi/<서버>.json` 이 그대로면 `pnpm gen` 을 빠뜨린 것이다 (`pnpm gen && git status --porcelain contract` 가 비어야 한다. CI 와 같은 검사로, 새로 생긴 생성물까지 잡는다).
  proto 는 `(cd contract && pnpm exec buf breaking --against '../.git#branch=main,subdir=contract')`.
- **ADR**: 어긋나면 번호를 든다. 어떤 ADR 도 다루지 않는 중요한 결정(새 통신 방식 · 저장소 · 인증 · 레이어 예외)이면 새 ADR 을 제안하는 질문을 남기고,
  결정을 바꿨는데 예전 ADR 을 "대체됨"으로 두지 않았으면 짚는다.
- **재사용**: 새 이름마다 이름(`rg -n "<이름>\b" servers clients contract --glob '!**/node_modules/**'`)과 하는 일(정규식 · 상수 · 라이브러리 호출)로 찾는다.
  바꿔 쓸 이름과 경로를 댈 수 있을 때만, 찾아본 명령과 함께 지적한다.

  | 어디 | 있는 것 |
  |---|---|
  | `@app/client` | `createClient<서버.paths>()` → `get` · `post` · `put` · `delete` · `query` (경로 변수는 `params`) |
  | notes (Node) | `src/support`: `get` · `post` · `put` · `del` · `mergeRoutes` · `BadRequest` · `NotFound`, `src/storage/db.ts` `db()` · `migrate.ts`, `src/clients/tags.ts` · `activity.ts`(교체 지점), 테스트 `request` · `sendJson` · `fakeTags` · `fakeActivity` |
  | activity (Spring) | `ApiErrors`, `CoreApiApplication.strictStrings`, 테스트 `@CoreApiTest` · `CleanDatabase` |
  | templates (Go) | `support.NotFound` · `api` 의 `jsonOnly` · 오류 변환(`huma.NewError`), `storage.Migrate`, 테스트 `support.Run` · `Do` · `SendJSON` · `Decode` · `AssertError` · `AssertBadRequest` · `CreateTemplate` · `Templates` · `MissingID` |
  | tags (FastAPI) | `support/errors.install` · `NotFound` · `support/security.install`, `storage/db.db()` · `migrate()`, 테스트 fixture `client` · `channel` · `clean_db` |

- **군더더기**: 에이전트가 쓴 티가 나는 줄. 고쳐 쓰기보다 지우기를 제안한다.
  1. 코드를 되풀이하는 주석 (코드로 드러나지 않는 이유는 남긴다).
  2. 입력만 바꿔 같은 분기를 되풀이하는 테스트, 단언이 없는 테스트.
  3. 요청하지 않은 덧붙임: 쓰는 곳이 하나뿐인 설정 · 옵션, 프레임워크가 이미 하는 예외 처리. "지우면 무엇이 깨지나?"에 답이 없으면 지운다.
  4. 위에서 이미 한 검사를 되풀이하거나 일어날 수 없는 경우를 막는 방어 코드.
  5. 부르는 곳이 없는 것, 그대로 넘기기만 하는 감싸개 (domain 의 위임은 레이어라서 둔다).

## 심각도 · 보고

- **P0**: 보안 · 개인정보 노출, 데이터 손실, 서버가 뜨지 않음 (적용된 마이그레이션 수정 등).
- **P1**: 계약 위반(문서 · 클라이언트 불일치, proto 호환 깨짐), 사용자에게 보이는 회귀, 채택된 ADR 위반.
- **P2**: 레이어 · 테스트 구조 위반, 이미 있는 것을 다시 만듦, 새 동작에 테스트가 없음.
- **P3**: 군더더기 · 작은 정리. 철저히 보라고 할 때만 적는다.

심각도 순으로 한 줄에 하나: `P1 [계약] 파일:줄 — 무엇이 깨지나 또는 어긴 규칙(문서). 고칠 방향`.
지적할 것이 없으면 `지적할 것 없음.` 과 확인하지 못한 것만 적는다. 칭찬, 근거 없는 위험, 묻지 않은 구현 제안은 쓰지 않는다.
마지막 줄에 읽은 문서와 건너뛴 것(맞는 경로 없음)을 적는다.
