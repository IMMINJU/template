# 엔드포인트 추가

notes 서버(Node)에 메모 하나의 길이를 돌려주는 `GET /api/notes/{id}/length` 를 더하는 예. 업무 로직 → 라우트 → 테스트 → 계약 생성 → 화면 순서다. 명령은 모두 저장소 루트에서 돌린다.

## 1. 업무 로직

`servers/notes/src/domain/note.ts` 에 함수를 더한다. 업무 로직이 모이는 곳이다.
같은 파일의 `get` 이 없는 메모면 `NotFound` 를 던지므로, 그 위에 쌓으면 404 처리를 다시 쓰지 않는다.

```ts
export const length = async (id: number) => (await get(id)).text.length
```

## 2. 라우트

`servers/notes/src/api/http/note.ts` 의 `routes` 에 경로를 더한다. zod 스키마가 입력 검증 · 핸들러 타입 · 문서가 된다.
문서에 들어가는 응답 스키마는 `.meta({ id })` 로 서버 안에서 유일한 이름을 붙인다. 경로 변수는 같은 파일의 `Id`(양의 정수)를 그대로 쓴다.

```ts
const NoteLength = z.object({ length: z.int() }).meta({ id: 'NoteLength' })

export const routes = {
  // '/api/notes' · '/api/notes/{id}' 는 그대로
  '/api/notes/{id}/length': {
    get: get({ params: Id, response: NoteLength }, async ({ params }) => ({
      length: await notes.length(params.id),
    })),
  },
}
```

- 메서드마다 도구가 있다: `get` · `put` 은 200, `post` 는 201, `del` 은 204(본문 없음). 반환값이 `response` 와 맞지 않으면 타입 오류다.
- `id` 가 양의 정수가 아니면 400, `NotFound` 는 404, 그 밖의 예외는 502 로 서버가 바꾼다.
- 새 도메인 모듈을 만들었다면 `src/api/http/server.ts` 의 `mergeRoutes(...)` 에 그 모듈의 `routes` 를 더한다. 같은 경로가 두 번 나오면 서버가 뜨지 않는다.

## 3. 테스트

경로가 곧 테스트 위치다: `/api/notes/{id}/length` → `tests/notes/id/length/GET_specs.ts`(경로 변수는 하위 폴더). 실제 서버가 랜덤 포트로 뜨고 테스트 DB(`notes_test`)를 쓴다.

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create } from '../../../../src/storage/note.ts'
import { request } from '../../../support/api.ts'

describe('GET /api/notes/{id}/length', () => {
  test('저장된_메모의_길이를_반환한다', async () => {
    const { id } = await create('안녕', [])

    const res = await request(`/api/notes/${id}/length`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { length: 2 })
  })

  test('없는_id면_404_Not_Found를_반환한다', async () => {
    const res = await request('/api/notes/999999999/length')

    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: '메모가 없습니다' })
  })
})
```

준비는 storage 의 `create(text, tags)` 로 하고, id 는 돌려받은 값을 쓴다(테스트 사이에 표를 비워도 id 는 되돌아가지 않는다).

```bash
pnpm infra
(cd servers/notes && node --test tests/notes/id/length/GET_specs.ts)   # 이 파일만 (괄호: 끝나면 루트로 돌아온다)
pnpm --filter @app/notes test                                           # 서버 전체
```

이름 · 본문 · Fake 규칙은 [testing.md](../testing.md). 에이전트에게는 `write-specs` skill 이 같은 절차를 준다.

## 4. 계약 생성

```bash
pnpm gen   # 루트에서. servers/notes 안에서 돌리면 그 서버의 notes.json 만 만들고 클라이언트 타입(notes.ts)은 그대로다
```

`contract/openapi/notes.json` 과 `notes.ts` 가 바뀐다. 손으로 고치지 않고 코드와 함께 커밋한다. 빠뜨리면 CI 가 실패한다.

## 5. 화면에서 부르기

`pnpm dev` 가 띄우는 web(React, `clients/apps/web/src/App.tsx`)에 붙인다. 메모마다 글자 수를 받아 카드에 보여 주는 컴포넌트를 더한다.
경로 · 경로 변수 · 응답 타입은 방금 만든 문서에서 오니, 경로를 틀리거나 `params` 를 빼면 타입 오류다.

```tsx
// App.tsx 아래에 더한다
function Length({ id }: { id: number }) {
  const { data } = useQuery(
    api.query('/api/notes/{id}/length', { params: { id } }),
  )
  return data && <span>({data.length}자)</span>
}
```

```tsx
// 카드의 메모 글 (원래 <p>{n.text}</p>). 카드는 글 | 버튼 두 칸이라 글 안에 붙인다
<p>
  {n.text} <Length id={n.id} />
</p>
```

```bash
pnpm typecheck   # gen 뒤 web 까지 타입 검사
pnpm dev         # 서버 넷 + web → http://localhost:5280
```

메모 `내일 회의` 를 추가하면 그 카드가 `내일 회의 (5자)` 가 되고 아래에 태그 `회의` 가 붙는다. 쿼리 키에 id 가 들어가 메모마다 따로 캐시된다.

프레임워크가 없는 lite · desktop 은 같은 호출을 `api.get('/api/notes/{id}/length', { params: { id } })` 로 그대로 부른다.
mobile · desktop 처럼 브라우저 밖의 앱은 `createClient` 에 `base` 로 notes 서버 주소(기본 `http://127.0.0.1:8000`)를 준다. → [구조 · 클라이언트](../architecture.md#클라이언트)

## 쓰기 엔드포인트

POST · PUT · DELETE 도 순서는 같다. 달라지는 곳:

- 본문은 JSON 만 받는다(다른 사이트가 form 으로 몰래 보내지 못하게). notes(Node)는 라우트에 `body` 스키마를 주면 서버가 검사한다.
  activity(Spring)는 본문을 받는 매핑(`@PostMapping` · `@PutMapping`)마다 `consumes = MediaType.APPLICATION_JSON_VALUE` 를 단다. tags(FastAPI)는 `support/security.py` 가 POST · PUT 만 검사하니 다른 메서드로 본문을 받으면 거기에 더한다.
  templates(Go)는 Huma 미들웨어 `jsonOnly`(`api/errors.go`, `api/server.go` 가 건다)가 본문이 있는 오퍼레이션을 모두 검사한다.
- 테스트는 응답과 함께 DB 를 storage 함수로 읽어 확인한다. 만들기는 201 과 만든 것, 지우기는 204 와 남은 목록, JSON 이 아닌 본문은 400 과 저장되지 않음을 본다.
  → `tests/notes/POST_specs.ts` · `tests/notes/id/DELETE_specs.ts`
- 클라이언트는 `api.post` · `put` · `delete` 를 부른다. TanStack Query 앱은 `useMutation` 으로 부르고 끝나면 바뀐 목록의 `queryKey` 로 `invalidateQueries`, 순수 TS 앱(lite · desktop)은 부른 뒤 목록을 다시 받는다. → [구조 · 클라이언트](../architecture.md#클라이언트)

## 다른 서버에서

순서는 같고 도구만 다르다. 같은 일을 언어마다 나란히 놓은 것은 [languages.md](../languages.md).

- **activity (Spring)**: 컨트롤러 메서드 + record DTO, 경로 변수는 `@PathVariable`. DTO 이름과 메서드 이름(operationId)은 서버 안에서 유일하게 짓는다.
  테스트는 경로를 따른 패키지의 `GET_specs` 클래스에 `@CoreApiTest` (예: `app.activity.GET_specs`). → [servers/activity/AGENTS.md](../../servers/activity/AGENTS.md)
- **tags (FastAPI)**: `server/api/routes/` 에 함수와 pydantic 모델, 경로 변수는 함수 인자. DB 드라이버가 동기라 핸들러는 `def` 로 쓴다.
  테스트는 경로를 따른 `tests/.../GET_specs.py` (예: `tests/tags/rules/GET_specs.py`). → [servers/tags/AGENTS.md](../../servers/tags/AGENTS.md)
- **templates (Go · Huma)**: `api/<도메인>.go` 에 `huma.Register` 오퍼레이션과 요청 · 응답 struct, 경로 변수는 `path:"id"` 태그. 타입 이름이 스키마 이름이고 operationId 는 직접 적는다.
  테스트는 경로를 따른 `tests/.../<METHOD>_specs_test.go` 의 `func Test<METHOD>` (예: `tests/templates/GET_specs_test.go`). → [servers/templates/AGENTS.md](../../servers/templates/AGENTS.md)

## 다음 실습

- [계약을 깨뜨려 보기](contract-lab.md): 응답 필드와 proto 번호를 바꿨을 때 어떤 검사가 실패하는지 확인한다.
- [외부 서비스 실패 테스트](external-service-lab.md): 실제 API · DB 에 외부 요약 서비스와 Fake 를 연결한다.
- [다른 서버 부르기](call-server.md): notes 가 tags · activity 를 부르는 흐름을 처음부터 따라간다.
