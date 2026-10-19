# 테스트는 왜 이렇게 됐나

*테스트가 통과했을 때 무엇을 믿어도 되는가*

notes 서버에서 `POST /api/notes` 의 업무 로직은 세 줄이다. tags 에 태그를 묻고, 저장하고, activity 에 기록을 남긴다.
이 세 줄을 단위 테스트로 검사하고 저장소와 다른 서버를 mock 으로 바꾸면 테스트는 쉽게 통과한다.
하지만 클라이언트가 실제로 겪는 실패는 대부분 그 세 줄 밖에서 생긴다. content-type 검사, 본문 크기 제한, 입력 검증, 오류를 400 · 502 로 바꾸는 코드,
그리고 SQL 이다. 함수마다 단위 테스트를 쓰고 의존성을 mock 으로 바꾸면 이 이음매가 모두 테스트 밖에 남는다.

그래서 이 템플릿의 기본 테스트는 **클라이언트가 부르는 그대로 부른다.** 실제 서버를 띄우고 실제 HTTP · gRPC 요청을 보낸다.
테스트가 통과하면 그 API 가 실제로 그렇게 동작한다고 볼 수 있다. 테스트 파일 이름이 `*_specs`(명세)인 이유다.
지켜야 할 규칙은 [testing.md](../testing.md), 결정의 기록은 [ADR-0003](../decisions/0003-api-tests-with-fakes.md) 에 있다.

```
HTTP · gRPC → 서버(랜덤 포트) → 본문 검증 → api → domain ─┬─ storage → 테스트 DB (docker 의 Postgres)
HTTP · gRPC ← JSON 응답 ← 오류 변환(400/502) ←────────────────────────┴─ clients → Fake
```

이 흐름에서 실제 구현이 아닌 것은 clients 자리의 Fake 하나다.

## 테스트 하나에 담긴 확인

notes 서버의 `tests/notes/POST_specs.ts` 에 있는 첫 테스트다.

```ts
test('올바른_메모를_보내면_201_Created와_태그를_매긴_메모를_반환하고_DB에_저장된다', async () => {
  fakeTags.tags = ['회의', '할일'] // ① tags 서버가 돌려줄 값

  const res = await sendJson('POST', '/api/notes', { text: '회의 할 일', junk: 1 }) // ② 실제 HTTP 요청

  assert.equal(res.status, 201) // ③ 상태 코드
  const { id } = res.body as Note
  assert.equal(typeof id, 'number')
  const note = { id, text: '회의 할 일', tags: ['회의', '할일'] }
  assert.deepEqual(res.body, note) // ④ 응답 본문
  assert.deepEqual(await list(), [note]) // ⑤ 저장 상태
  assert.deepEqual(fakeTags.texts, ['회의 할 일']) // ⑥ tags 서버에 보낸 것
})
```

1. tags 서버는 띄우지 않는다. 그 자리의 Fake 에 돌려줄 태그만 정한다. 정하는 것은 바깥의 조건이고, 그 태그를 저장하고 응답에 싣는 것은 실제 코드다.
2. 요청의 `junk: 1` 은 문서에 없는 필드다. 서버는 이 필드 때문에 실패하지도, 이 필드를 저장하지도 않아야 한다. 입력이 신뢰 경계라는 규칙을 이 필드가 검사한다.
3. 만들기는 200 이 아니라 201 이다. 상태 코드도 계약의 일부라 따로 확인한다.
4. 본문은 일부가 아니라 전체를 비교한다(`deepEqual`). 응답에 필드가 하나 더 붙어도 클라이언트가 받는 계약은 바뀐 것이다.
   id 는 응답에서 꺼내 쓴다. 테스트 사이에 표를 비워도 id 는 되돌아가지 않으므로 1 이라고 가정하지 않는다.
5. 저장 상태는 SQL 을 다시 쓰지 않고 storage 의 `list()` 로 확인한다. 테스트가 묻는 것은 어떻게 저장했는지가 아니라 저장했는지이므로, 표 구조를 바꿔도 테스트는 그대로다.
6. tags 서버에 메모 내용을 보냈는지 본다. 다른 서버에 무엇을 보냈는지도 이 API 가 하는 일의 일부다.

같은 파일의 다른 테스트는 바깥이 실패하는 경우를 다룬다. tags 가 실패하면 502 를 받고 아무것도 저장되지 않는지, activity 가 실패해도 201 을 받는지.
잘못된 입력 여섯 가지(`null`, 배열, 문자열, 빈 객체, 숫자, 10,001 자)가 모두 400 을 받고 저장되지 않는지도 본다.
오류를 응답하면서 저장은 해 버리는 버그는 응답만 봐서는 드러나지 않는다.

tags 의 `tests/tags/rules/POST_specs.py`, activity 의 `app.activity.GET_specs`, templates 의 `tests/templates/POST_specs_test.go` 도 같은 모양이다. 실제 서버를 부르고 상태 코드와 본문 전체를 보며, DB 는 storage 의 저장소로 채우거나 확인한다.
언어가 달라도 명세를 쓰는 방법이 같다.

## 포트는 운영체제가 고른다

`tests/support/api.ts` 는 서버를 포트 0 으로 띄운다. 포트 0 을 요청하면 운영체제가 비어 있는 포트를 골라 준다.

```ts
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
```

8000 같은 고정 포트를 쓰면 실행 중인 개발 서버와 충돌하고, 여러 서버의 테스트를 동시에 돌릴 수 없다. 랜덤 포트에서는 두 문제가 생기지 않는다.

## 테스트 DB 는 운영과 같은 엔진이다

H2 · SQLite 같은 인메모리 DB 는 빠르고 따로 설치할 필요가 없다. 하지만 운영과 다른 엔진이다.
notes 가 태그를 담는 `TEXT[]` 열과 `INSERT ... RETURNING` 은 Postgres 문법이라 엔진마다 다르게 처리되거나 지원되지 않는다. 타입 · 제약 · 정렬 규칙도 다르다.
이 차이를 두면 테스트는 통과하고 운영에서 실패하거나, 테스트를 통과시키려고 운영 SQL 을 모든 엔진이 받는 문법으로 줄이게 된다.

그래서 테스트 DB 는 운영과 같은 Postgres 다. 테스트가 운영 엔진으로 돌면 지원하는 DB 마다 테스트도 따로 돌아야 하므로, ADR-0004 는 DB 를 하나로 정했다. 대신 테스트에 Docker 가 필요하다(`pnpm infra`).
이 compose 파일은 개발 · CI 와 같은 파일이라 테스트를 위해 따로 관리할 것은 없다. 테스트 DB 는 `<서버>_test` 로 따로 있어 개발 데이터를 지우지 않는다.

## 데이터는 rollback 이 아니라 TRUNCATE 로 지운다

흔히 쓰는 방법은 테스트를 트랜잭션으로 감싸고 끝나면 rollback 하는 것이다(Spring 의 `@Transactional` 테스트). 이 구조에서는 이 방법이 통하지 않는다.
요청을 처리하는 것은 다른 스레드 · 다른 DB 연결에서 도는 실제 서버이고, 서버가 커밋한 데이터는 테스트의 트랜잭션 밖에 있다. rollback 으로는 지워지지 않는다.

그래서 테스트 앞뒤로 마이그레이션 기록 표를 뺀 모든 표를 비운다. `pg_tables` 로 표를 찾아 `TRUNCATE` 한다. 앞에서 비우면 지난 실행이 중간에 멈춰 데이터가 남아 있어도 깨끗하게 시작한다.
뒤에서 비우면 다음 테스트 파일이 깨끗하게 시작한다.

같은 DB 를 쓰는 테스트가 동시에 돌면 한쪽의 TRUNCATE 가 다른 쪽의 데이터를 지운다. 그래서 한 서버 안의 테스트는 차례로 돈다(notes 는 `--test-concurrency=1`, templates 는 `go test -p 1`).
서버끼리는 DB 가 달라 동시에 돌아도 된다.

## 외부 시스템은 Fake 로 바꾼다

결제 · 메일 · 다른 서버를 테스트마다 띄울 수는 없으므로 대역이 필요하다. 여기서는 호출 기대값을 검사하는 방식과,
이 템플릿이 선택한 API 결과 중심의 방식을 비교한다.

| | 호출 구조를 검사하는 mock 테스트 | 이 템플릿의 Fake 기반 API 테스트 |
|---|---|---|
| 바꾸는 방법 | 테스트 대역을 넣고 호출 기대값을 설정한다 | 같은 인터페이스를 구현한 작은 구현을 교체 지점에 넣는다 |
| 검사하는 것 | 함수가 어떤 인자로 불렸는지(호출 구조) | 외부가 이렇게 응답하면 API 가 어떻게 동작하는지(결과) |
| 구현을 리팩터링하면 | 기대값으로 고정한 호출 구조가 바뀌면 실패한다 | 내부 호출보다 API 결과에 의존하므로 영향을 줄인다 |
| 실제 외부와 다르게 응답하면 | 그대로 통과할 수 있어 외부 클라이언트는 별도로 검사한다 | 그대로 통과할 수 있어 외부 클라이언트는 별도로 검사한다 |

이 표는 이 저장소가 선택한 테스트 방식을 비교한 것이며, 모든 mock 과 Fake 의 성질을 나눈 것은 아니다.
`patch` 같은 교체 도구로 결과 중심 테스트를 쓸 수도 있고, Fake 로 호출 횟수에 의존하는 테스트를 쓸 수도 있다.
무엇으로 바꾸는가와 무엇을 assertion 하는가는 별개의 선택이다.

호출 구조를 세세히 고정하면 동작이 같은 리팩터링에도 테스트가 깨진다. 이 저장소는 외부 대역의 위치를 명시하고 결과를 검사하기 위해
인터페이스를 통한 교체와 Fake 를 기본으로 정했다(ADR-0003). hook 의 mock 금지도 이 저장소의 규칙이며, 모든 프로젝트에 필요한 규칙은 아니다.

Fake 는 테스트 공통 설정(`tests/support/api.ts`)이 `clients/` 의 교체 지점에 한 번 넣는다. notes 가 부르는 tags 서버가 예다.

```ts
// src/clients/tags.ts — 밖에는 인터페이스와 교체 지점만 보인다
export interface Tags { suggest(text: string): Promise<string[]> }
export let tags: Tags = grpcTags
/** 테스트가 Fake 로 바꿀 때만 쓴다 */
export const useTags = (t: Tags) => (tags = t)

// tests/support/fakes.ts — 외부 조건만 통제한다
export class FakeTagService implements Tags {
  tags: string[] = []                 // 돌려줄 값
  readonly texts: string[] = []       // 받은 인자 기록
  #fail = false
  failNext() { this.#fail = true }    // 다음 호출 실패
  async suggest(text: string) {
    if (this.#fail) { this.#fail = false; throw new Error('연결할 수 없음') }
    this.texts.push(text)
    return this.tags
  }
  reset() { this.tags = []; this.texts.length = 0; this.#fail = false }
}
```

이 Fake 로 "tags 가 실패하면 API 가 502 를 응답하고 저장하지 않는다"를 실제 domain 코드로 검사한다.
같은 모양의 `FakeActivityService` 로는 반대 정책, "activity 가 실패해도 201 이다"를 검사한다. 실패를 어떻게 다룰지는 domain 이 정하고 Fake 는 실패만 만든다.

**Fake 에는 업무 규칙을 넣지 않는다.** "실패하면 세 번까지 다시 보낸다"를 Fake 안에 구현하면 테스트가 검사하는 대상이 Fake 가 된다.
Fake 는 첫 호출은 실패하고 다음 호출은 성공하는 외부 조건만 만들고, 다시 보내는 일은 실제 domain 이 하게 둔다.
그래야 domain 의 재시도 코드가 망가졌을 때 테스트가 실패한다.

Fake 가 보장하지 않는 것도 있다. `texts` 에 기록됐다고 해서 실제 tags 서버가 그 요청을 받아 같은 답을 준다는 뜻은 아니다.
받는 쪽은 tags 의 `Suggest_specs` 가 실제 gRPC 로 검사하고, 둘이 실제로 이어지는지는 전체 스택의 smoke 가 본다.

실제 서버에 Fake 를 넣어 성공 · 외부 실패 · 없는 메모를 검사하는 실습은 [외부 서비스 실패 테스트](../guides/external-service-lab.md)에 있다.

## 이름이 테스트의 위치와 뜻을 알려 준다

테스트의 위치는 경로에서 정해진다. `POST /api/notes` 의 테스트는 `tests/notes/POST_specs.ts`, 경로 변수가 있는 `DELETE /api/notes/{id}` 는
`tests/notes/id/DELETE_specs.ts` 에 있다. 엔드포인트를 알면 테스트를 찾을 수 있고,
테스트 파일이 없는 엔드포인트는 목록에서 바로 보인다. 새 테스트를 어디에 둘지 사람도 에이전트도 고민하지 않는다.

테스트 이름에는 조건과 결과를 쓴다. `메모가_문자열이_아니거나_너무_길면_400_Bad_Request를_반환하고_저장하지_않는다` 처럼 쓰면
실패 메시지 한 줄로 무엇이 깨졌는지 알 수 있고, 테스트 목록을 위에서부터 읽으면 그 API 의 명세가 된다.
네 서버가 같은 이름 규칙을 쓰므로 서버를 다른 언어로 옮길 때 테스트 목록을 그대로 확인 목록으로 쓸 수 있다.

## 층마다 확인하는 것이 다르다

| 층 | 확인하는 것 | 실행하는 곳 |
|---|---|---|
| 서비스 테스트 (`*_specs`) | 경우마다의 동작: 성공 · 400 · 404 · 502 · 저장 상태 | `pnpm test`, CI |
| 전체 스택 smoke | 이미지 · 컨테이너 네트워크 · 환경 변수 · 프록시의 연결 | `pnpm stack` (로컬) |
| 브라우저 확인 | 화면 · 콘솔 · 실제 프록시 | `verify-local` skill |

smoke 는 태그 규칙 하나와 메모 하나를 만들어 서버와 웹 앱마다의 프록시(`/api/<서버>`)에서 읽어 보고 지운다. 경우의 수는 이미 서비스 테스트가 확인하므로, smoke 에서 같은 경우를 반복하면 느리고 불안정한 테스트만 늘어난다.
smoke 가 보는 것은 서비스 테스트로 확인할 수 없는 것, 곧 이미지가 제대로 만들어졌는지와 컨테이너끼리 이름으로 서로를 찾는지뿐이다.

## 이 방식이 맞지 않는 경우

| 비용 | 얻는 것 |
|---|---|
| 단위 테스트보다 느리다(서버 · DB) | 통과하면 API 가 실제로 그렇게 동작한다 |
| Docker 가 필요하다 | 운영과 같은 SQL 을 검사한다 |
| 한 서버 안에서는 병렬로 돌지 않는다 | 테스트끼리 데이터가 섞이지 않는다 |
| Fake 를 직접 만든다 | 리팩터링에 잘 깨지지 않는 테스트 |

날짜 계산이나 파서처럼 입력과 출력만 있는 순수 함수에는 이 비용이 필요 없다. 이런 함수는 목적이 드러나는 이름으로 단위 테스트를 따로 둔다.
