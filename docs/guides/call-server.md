# 다른 서버 부르기

notes 가 메모를 저장하기 전에 tags 에 태그를 묻는 흐름이 예다. 새 호출도 순서가 같다:
proto → 받는 서버 구현 → 부르는 쪽 clients → 실패했을 때 할 일 → 테스트 → 연결(환경 변수 · compose · smoke). 명령은 모두 저장소 루트에서 돌린다.

```
web ──HTTP──▶ notes ──gRPC TagService.Suggest──▶ tags
                    └───gRPC ActivityService.Record──▶ activity
```

앱은 자기 프록시로 notes 를 HTTP 로 부르고, 서버 사이는 gRPC 로 직접 부른다(ADR-0002).

## 1. proto

`contract/proto/app/<도메인>/v1/<도메인>.proto` 에 서비스 · 메시지를 쓴다. 디렉터리가 패키지다(`app/tag/v1` → `app.tag.v1`).

```proto
service TagService {
  rpc Suggest(SuggestRequest) returns (SuggestResponse);
}
message SuggestRequest { string text = 1; }
message SuggestResponse { repeated string tags = 1; }
```

`pnpm gen` 이 buf lint 뒤 언어마다 코드를 만든다. 필드 번호는 바꾸거나 다시 쓰지 않는다(ADR-0002). → [contracts.md](../contracts.md#grpc-공통-proto-가-기준-adr-0002)

## 2. 받는 서버

받는 서버의 api 층에 서비스를 구현하고 domain 을 부른다. tags(FastAPI)는 `server/api/rpc/tags.py`, activity(Spring)는 `core/core-api` 의 `app/core/api/grpc/ActivityGrpcService.java`.
테스트는 실제 gRPC 연결로 부른다: `tests/grpc/TagService/Suggest_specs.py`, 묶음 이름은 gRPC 경로 `/app.tag.v1.TagService/Suggest`.

## 3. 부르는 쪽: clients 레이어

다른 서버는 외부 시스템이다. 부르는 서버의 `clients/` 에 서버 하나당 모듈 하나를 두고, 밖에는 작은 인터페이스와 교체 지점만 보인다.

```ts
// servers/notes/src/clients/tags.ts
export interface Tags {
  suggest(text: string): Promise<string[]>
}

// 만들 때는 접속하지 않는다 (처음 부를 때 연결). 서버가 멈춰도 쓰기가 계속 기다리지 않게 시간 제한
const client = createClient(TagService, createGrpcTransport({ baseUrl: config.tagsGrpc, defaultTimeoutMs: 3_000 }))
const grpcTags: Tags = { suggest: async (text) => (await client.suggest({ text })).tags }

export let tags: Tags = grpcTags
/** 테스트가 Fake 로 바꿀 때만 쓴다 */
export const useTags = (t: Tags) => (tags = t)
```

주소는 `src/config.ts` 가 환경 변수 `<서버>_GRPC`(여기서는 `TAGS_GRPC`, 기본 `http://127.0.0.1:9002`)에서 읽어 `config.tagsGrpc` 로 둔다.

## 4. 실패하면 어떻게 할지

다른 서버는 언젠가 멈춘다. 그때 응답을 어떻게 할지는 domain 이 호출마다 정한다. 예시의 두 호출은 답이 다르다.

| 호출 | 실패하면 | 이유 |
|---|---|---|
| tags `Suggest` (저장 전) | 저장하지 않고 502 `태그 서버에 연결할 수 없습니다` | 태그는 메모의 일부다. 태그 없이 저장하면 나중에 채울 방법이 없다 |
| activity `Record` (저장 뒤) | 경고만 남기고 201 · 200 · 204 | 기록은 부가 정보다. 기록 때문에 이미 저장한 메모를 실패로 돌려주면 사용자는 다시 보내고 메모가 둘이 된다 |

```ts
// servers/notes/src/domain/note.ts
export async function create(text: string) {
  const note = await notes.create(text, await suggest(text)) // 실패하면 던진다 → 502
  await record('note.created', note.id) // 실패하면 console.warn 만
  return note
}
```

메모 저장과 activity 호출은 한 트랜잭션이 아니다. 그래서 지금 정책에서는 기록이 빠질 수 있다: activity 가 멈춰 있을 때, 그리고 메모를 저장한 직후 notes 가 죽었을 때다.
기록을 반드시 남겨야 한다면 경고만 남기는 것으로는 안 되고 설계가 따로 필요하다. 흔한 방법은 메모와 "보낼 기록"을 같은 DB 트랜잭션으로 쓰고(아웃박스 표),
따로 도는 작업이 activity 가 받을 때까지 다시 보내는 것이다. 같은 기록이 두 번 갈 수 있으니 activity 는 같은 기록을 한 번만 저장해야 한다(멱등).
템플릿에는 없고, 고르면 ADR 로 남긴다. 정한 것은 그 서버 `AGENTS.md` 에 적는다.

## 5. 테스트: 다른 서버는 Fake

부르는 서버의 테스트는 다른 서버를 띄우지 않는다. 교체 지점에 Fake 를 넣고, Fake 로는 외부 조건(돌려줄 값 · 다음 한 번 실패 · 받은 인자)만 정한다.
실패를 502 로 바꾸는 것은 실제 domain · 오류 처리가 한다. 그 연결이 검증 대상이다. → [testing.md](../testing.md#fake)

```ts
// servers/notes/tests/notes/POST_specs.ts
test('태그_서버에_연결할_수_없으면_502_Bad_Gateway를_반환하고_저장하지_않는다', async () => {
  fakeTags.failNext()

  const res = await sendJson('POST', '/api/notes', { text: '안녕' })

  assert.equal(res.status, 502)
  assert.deepEqual(res.body, { error: '태그 서버에 연결할 수 없습니다' })
  assert.deepEqual(await list(), [])
})
```

Fake 는 `tests/support/fakes.ts` 에 두고 `tests/support/api.ts` 가 한 번 넣고 테스트마다 `reset()` 한다. mock(`mock.module`)은 쓰지 않는다(ADR-0003).

## 6. 연결

- 부르는 서버의 `.env.template` 에 주소(`# TAGS_GRPC=http://127.0.0.1:9002`).
- `docker/docker-compose.yaml` 의 부르는 서버에 `TAGS_GRPC: "http://tags:9002"` (compose 네트워크 안의 서비스 이름).
- `docker/smoke.sh` 에 흐름 하나: 실제 이미지끼리 이어지는지만 본다(지금은 notes 덩어리에서 만든 메모에 태그가 붙고 activity 에 기록이 남는지).
- `pnpm drop` 은 `<서버>_GRPC` 로 부르는 쪽을 찾아, 부르는 서버가 남아 있으면 받는 서버를 빼지 않는다.
- 꼭 필요한 호출이면 루트 `pnpm dev` 의 기본 조합에 받는 서버를 넣는다(지금은 notes · tags · activity · templates 와 web 을 같이 띄운다).

## 확인

```bash
pnpm gen && pnpm typecheck
pnpm infra                       # 테스트 DB (docker 의 Postgres)
pnpm --filter @app/tags test     # 받는 쪽: 실제 gRPC
pnpm --filter @app/notes test    # 부르는 쪽: Fake 로 성공 · 실패
pnpm stack                       # 실제 이미지끼리 (smoke)
```
