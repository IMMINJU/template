---
name: write-specs
description: 서버에 엔드포인트 · RPC 를 더하거나 동작을 바꿀 때, 사용자가 서버 테스트를 써 달라거나 /write-specs·$write-specs 를 부를 때 이 저장소의 API 테스트({METHOD}_specs, 실제 서버, Fake)를 쓴다. 리뷰만 하는 요청, 클라이언트 앱 테스트, 브라우저 확인(verify-local)에는 쓰지 않는다.
---

# API 테스트 쓰기

테스트 규칙은 `docs/testing.md`, 공통 설정 · 실행 방법은 그 서버 `AGENTS.md` 의 "테스트" 가 갖는다.
이 skill 은 순서만 갖고 규칙을 따로 두지 않는다.

## 순서

1. 바뀐 동작의 주인을 정한다: 어느 서버, 어느 리소스 경로 · 메서드 (gRPC 는 서비스 · RPC).
2. `docs/testing.md` 와 그 서버 `AGENTS.md` "테스트" 를 읽는다.
3. 파일: 있으면 그 `{METHOD}_specs` (gRPC 는 `grpc/{Service}/{Rpc}_specs`)에 시나리오를 더하고, 없으면 같은 서버의 기존 specs 를 본떠 만든다.
   - notes (Node) `servers/notes/tests/<경로>/GET_specs.ts`
   - activity (Spring) `servers/activity/core/core-api/src/test/java/app/<경로>/GET_specs.java`
   - tags (FastAPI) `servers/tags/tests/<경로>/GET_specs.py`
   - templates (Go) `servers/templates/tests/<경로>/GET_specs_test.go` (Go 테스트 파일은 `_test.go` 로 끝나야 한다)
4. 시나리오: 성공(응답 + storage 로 본 저장 상태 + 부수 효과), 입력 검증 실패(400, `{ error }` 필드),
   외부 클라이언트 · 다른 서버를 부르면 그 실패가 그 서버 `AGENTS.md` 에 적힌 정책대로 되는지(notes: tags 실패 502, activity 실패는 그래도 성공). 입력만 바꾼 같은 분기를 되풀이하지 않는다.
5. 외부 클라이언트는 공통 설정의 Fake 로 바꾼다. 없으면 공통 설정 옆에 `Fake{Name}` 를 만들어 등록하고 테스트 전후에 reset 한다. mock 은 쓰지 않는다(hook 이 막는다).
6. 테스트 DB 가 docker 의 Postgres 라 먼저 루트에서 `pnpm infra`. 가장 좁게 먼저 돌리고, 통과하면 그 서버 전체를 한 번:
   - notes: `(cd servers/notes && node --test tests/<경로>/GET_specs.ts)` → `pnpm --filter @app/notes test`
   - activity: `(cd servers/activity && ./gradlew test --tests 'app.<경로>.GET_specs')` → `pnpm --filter @app/activity test`
   - tags: `(cd servers/tags && uv run pytest tests/<경로>/GET_specs.py)` → `pnpm --filter @app/tags test`
   - templates: `(cd servers/templates && go test -p 1 ./tests/<경로>/...)` → `pnpm --filter @app/templates test`
7. API 를 바꿨으면 `pnpm gen` · `pnpm typecheck` 로 계약과 클라이언트도 맞춘다.

## 보고

더한 시나리오(파일 · 테스트 이름), 돌린 명령과 결과, 덮지 못한 것(실제 외부 서비스 · 브라우저 · 이미지로 띄운 스택 등)을 적는다.
가치가 낮은 테스트를 지우자는 제안도 더하자는 제안만큼 한다.
