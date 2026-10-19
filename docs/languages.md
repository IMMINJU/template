# 같은 일, 네 언어

예시 서버 넷은 맡은 일이 다르다(notes · tags · activity · templates). 그래도 서버마다 같은 종류의 일을 하니 나란히 놓고 볼 수 있다:
목록을 HTTP 로 내주고, 문서를 만들고, DB 를 읽고, gRPC 를 주고받고(templates 는 없다), 실제 서버로 테스트한다.
서버의 언어는 그 서버의 선택이다. notes 가 Node 인 것은 규칙이 아니고 예시다.

| 일 | notes · Node | tags · FastAPI | activity · Spring | templates · Go |
|---|---|---|---|---|
| HTTP 라우트 · 검증 | zod 스키마 + `get` · `post` 도구 | pydantic 모델 + 함수 | record DTO + Bean Validation | struct 태그 + `huma.Register` (Huma v2) |
| 문서 만들기 (`pnpm gen`) | `src/openapi.ts` (zod → openapi) | `server/gen.py` (`app.openapi()`) | `OpenApiExport` (springdoc, 테스트 의존성) | `go run . gen` (Huma 의 `OpenAPI()`) |
| gRPC | 클라이언트 (Connect-ES) | 서버 (grpcio) | 서버 (grpc-java · Spring gRPC) | 없음 |
| DB 읽기 · 쓰기 | postgres.js 태그 템플릿 | psycopg 3 연결 풀 | JdbcClient | pgx v5 연결 풀 (`RowToStructByPos`) |
| 마이그레이션 | node-pg-migrate (SQL 파일) | Alembic (`op.execute`) | Flyway (SQL 파일) | goose v3 (SQL 파일, embed) |
| 테스트 | `node:test` + 실제 서버 | pytest + uvicorn(스레드) | JUnit + `@SpringBootTest(RANDOM_PORT)` | `go test` + `httptest` (실제 핸들러) |
| 다른 서버 대역 | 교체 지점 `useTags(fake)` | `app.dependency_overrides` (생기면) | `@TestConfiguration` 의 `@Primary` Bean (생기면) | 없음 (부르는 서버가 없다) |
| lint · format | oxlint · oxfmt | ruff | spring-javaformat · `-Werror` | gofmt · go vet |

규칙(레이어 · 오류 형식 · 테스트 이름)은 넷이 같다 → [architecture.md](architecture.md) · [testing.md](testing.md). 세부는 각 서버의 `AGENTS.md`.

## 목록 하나를 HTTP 로

검증 규칙 · 응답 모양을 타입 하나에 쓰면 그것이 곧 openapi 문서가 된다. 넷 다 방식은 같고 도구만 다르다.

```ts
// notes · servers/notes/src/api/http/note.ts
const NoteList = z.object({ notes: z.array(Note) }).meta({ id: 'NoteList' })

export const routes = {
  '/api/notes': {
    get: get({ response: NoteList }, async () => ({ notes: await notes.list() })),
  },
}
```

```python
# tags · servers/tags/server/api/routes/rules.py
class RuleList(BaseModel):
    rules: list[Rule]


@router.get('/api/tags/rules')
def list_rules() -> RuleList:
    return RuleList(rules=[Rule.model_validate(r) for r in service.find_all()])
```

```java
// activity · servers/activity/core/core-api/.../api/controller/ActivityController.java
record ActivityList(@NotNull List<Activity> activities) {
}

@GetMapping
ActivityList listActivity() {
	return new ActivityList(activity.list().stream().map(Activity::of).toList());
}
```

```go
// templates · servers/templates/api/template.go
type TemplateList struct {
	Templates []Template `json:"templates" nullable:"false"`
}

huma.Register(api, huma.Operation{
	OperationID: "listTemplates",
	Method:      http.MethodGet,
	Path:        "/api/templates",
	Responses:   errorResponses(api, 502),
}, func(ctx context.Context, _ *struct{}) (*struct{ Body TemplateList }, error) {
	ts, err := domain.List(ctx)
	if err != nil {
		return nil, err
	}
	out := &struct{ Body TemplateList }{TemplateList{Templates: make([]Template, len(ts))}}
	for i, t := range ts {
		out.Body.Templates[i] = Template(t)
	}
	return out, nil
})
```

## gRPC: 한 proto, 서버 둘 · 클라이언트 하나

`contract/proto` 의 파일 하나에서 언어마다 코드를 만든다. tags · activity 는 서버로 구현하고 notes 는 클라이언트로 부른다.
templates 는 다른 서버를 부르지도 불리지도 않아 gRPC 가 없다.

```python
# tags · servers/tags/server/api/rpc/tags.py
class TagService(tag_pb2_grpc.TagServiceServicer):
    def Suggest(self, request, context):
        return tag_pb2.SuggestResponse(tags=rules.suggest(request.text))
```

```java
// activity · servers/activity/core/core-api/.../api/grpc/ActivityGrpcService.java
@Override
public void record(RecordRequest request, StreamObserver<RecordResponse> response) {
	if (request.getAction().isBlank() || request.getNoteId() <= 0) {
		response.onError(Status.INVALID_ARGUMENT.withDescription("action 과 양수 note_id 가 필요합니다").asException());
		return;
	}
	activity.record(request.getAction(), request.getNoteId());
	response.onNext(RecordResponse.getDefaultInstance());
	response.onCompleted();
}
```

```ts
// notes · servers/notes/src/clients/tags.ts (부르는 쪽)
const client = createClient(TagService, createGrpcTransport({ baseUrl: config.tagsGrpc, defaultTimeoutMs: 3_000 }))
const grpcTags: Tags = { suggest: async (text) => (await client.suggest({ text })).tags }
```

## 마이그레이션 하나

```sql
-- notes · servers/notes/migrations/0003_note_tags.sql
-- Up Migration
ALTER TABLE notes ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
```

```python
# tags · servers/tags/migrations/versions/0001_rules.py
def upgrade() -> None:
    op.execute('CREATE TABLE rules (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, keyword TEXT NOT NULL, tag TEXT NOT NULL)')
```

```sql
-- activity · servers/activity/storage/db-core/src/main/resources/db/migration/V1__activity.sql
CREATE TABLE activity (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action TEXT NOT NULL, note_id BIGINT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now());
```

```sql
-- templates · servers/templates/migrations/0001_templates.sql
-- +goose Up
CREATE TABLE templates (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL);
```

## 테스트 하나

넷 다 실제 서버를 랜덤 포트로 띄우고 밖에서 부른다. 이름은 조건과 결과를 한글_밑줄로.

```ts
// notes · servers/notes/tests/notes/POST_specs.ts — 다른 서버는 Fake
test('태그_서버에_연결할_수_없으면_502_Bad_Gateway를_반환하고_저장하지_않는다', async () => {
  fakeTags.failNext()

  const res = await sendJson('POST', '/api/notes', { text: '안녕' })

  assert.equal(res.status, 502)
  assert.deepEqual(await list(), [])
})
```

```python
# tags · servers/tags/tests/grpc/TagService/Suggest_specs.py — 실제 gRPC 연결
def test_대소문자를_가리지_않고_같은_태그는_한_번만_반환한다(channel):
    rules.create('할 일', '할일')
    rules.create('todo', '할일')

    res = suggest(channel, 'TODO: 오늘 할 일')

    assert res.tags == ['할일']
```

```java
// activity · servers/activity/core/core-api/src/test/java/app/grpc/activityservice/Record_specs.java
@Test
void 올바른_기록을_보내면_DB에_저장된다() {
	var res = client.record(RecordRequest.newBuilder().setAction("note.created").setNoteId(7).build());

	assertThat(res).isEqualTo(RecordResponse.getDefaultInstance());
	assertThat(activity.findRecent(100)).extracting(ActivityEntity::action, ActivityEntity::noteId)
		.containsExactly(tuple("note.created", 7L));
}
```

```go
// templates · servers/templates/tests/templates/id/PUT_specs_test.go — 실제 핸들러 · 테스트 DB
support.Run(t, "없는_id면_404_Not_Found를_반환한다", func(t *testing.T) {
	id := support.MissingID(t)

	res := support.SendJSON(t, "PUT", fmt.Sprintf("/api/templates/%d", id), map[string]any{"name": "후", "body": "후"})

	support.AssertError(t, res, 404, "템플릿이 없습니다")
	if saved := support.Templates(t); len(saved) != 0 {
		t.Errorf("저장된 템플릿 = %+v, 없어야 한다", saved)
	}
})
```
