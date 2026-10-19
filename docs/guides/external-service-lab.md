# 외부 서비스 실패 테스트

*실제 서버와 DB 는 그대로, 외부의 성공과 실패만 Fake 로 정한다*

notes 서버에 `GET /api/notes/{id}/summary` 를 더한다. 저장된 메모를 읽고 외부 요약 서비스에 보내는 API 다.
실습용 변경이므로 기본 템플릿에는 이 기능이나 외부 서비스 의존성이 들어 있지 않다.
[엔드포인트 추가](add-endpoint.md)를 따라 해 보았고, notes 서버의 기존 테스트가 통과하는 상태에서 시작한다. 명령은 모두 저장소 루트에서 돌린다.

notes 는 이미 다른 서버(tags · activity)를 Fake 로 바꿔 테스트한다. 그 둘은 우리가 proto 로 합의한 서버이고,
이번 요약 서비스는 형식을 우리가 정하지 않은 밖의 HTTP 서비스다. 그래서 응답을 실행 중에 검사하는 것까지 해 본다.

완료 기준은 세 가지다. 성공하면 요약과 200, 외부가 실패하면 502, 메모가 없으면 외부를 부르지 않고 404 를 반환한다.
조회 API 이므로 어느 경우에도 메모는 바뀌지 않아야 한다. 실제 외부 서비스나 API 키 없이 테스트할 수 있다.

## 1. 외부 클라이언트와 교체 지점

주소는 옆의 `tags.ts` · `activity.ts` 처럼 `src/config.ts` 에서 읽는다. `config` 에 한 줄, `servers/notes/.env.template` 에 한 줄을 더한다.
외부 서비스라 기본값은 두지 않는다.

```ts
// servers/notes/src/config.ts 의 config 안
  // 외부 요약 서비스. 정하지 않으면 요약을 부를 때 실패한다
  summaryUrl: process.env.SUMMARY_URL,
```

```bash
# servers/notes/.env.template
# 외부 요약 서비스: { text } 를 받아 { summary } 를 돌려준다
# SUMMARY_URL=
```

`servers/notes/src/clients/summary.ts` 를 만든다. 옆의 `tags.ts` · `activity.ts` 와 같은 모양이다.
모듈을 import 할 때는 외부에 접속하지 않고 `summarize()` 를 호출할 때만 연결한다.

```ts
import { config } from '../config.ts'

export interface Summarizer {
  summarize(text: string): Promise<string>
}

export const httpSummarizer: Summarizer = {
  async summarize(text) {
    const url = config.summaryUrl
    if (!url) throw new Error('SUMMARY_URL 이 필요합니다')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`요약 서비스 오류: ${res.status}`)
    const body: unknown = await res.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      !('summary' in body) ||
      typeof body.summary !== 'string'
    )
      throw new Error('요약 응답 형식이 아닙니다')
    return body.summary
  },
}

export let summarizer: Summarizer = httpSummarizer
/** 테스트 공통 설정에서만 Fake 로 바꾼다 */
export const useSummarizer = (next: Summarizer) => (summarizer = next)
```

`SUMMARY_URL` 의 서비스가 `{ text: string }` 을 받아 `{ summary: string }` 을 반환한다고 가정한다.
여기서는 해당 서비스를 구현하거나 실행하지 않는다. 테스트에서는 아래 Fake 로 바꾼다.
응답의 `unknown` 검사는 외부 신뢰 경계의 런타임 검증이며, TypeScript 타입 단언과 다르다.

## 2. 업무 로직과 라우트

`servers/notes/src/domain/note.ts` 에 import 와 함수를 더한다. 메모가 없으면 기존 `get` 에서 멈춘다.

```ts
import { summarizer } from '../clients/summary.ts'

export const summary = async (id: number) => {
  const note = await get(id)
  return { summary: await summarizer.summarize(note.text) }
}
```

`servers/notes/src/api/http/note.ts` 에 응답 스키마를 더한다.

```ts
const NoteSummary = z.object({ summary: z.string() }).meta({ id: 'NoteSummary' })
```

같은 파일의 `routes` 에 경로를 더한다. `get` · `Id` · `notes` 는 이미 있는 것을 쓴다.

```ts
'/api/notes/{id}/summary': {
  get: get({ params: Id, response: NoteSummary }, async ({ params }) =>
    notes.summary(params.id),
  ),
},
```

오류를 Fake 안에서 HTTP 응답으로 바꾸지 않는다. 실제 서버의 기존 오류 처리가 외부 실패는 502 로,
domain 의 `NotFound`(없는 메모)는 404 로 바꾼다.

## 3. Fake 와 공통 설정

`servers/notes/tests/support/fakes.ts` 에 Fake 를 더한다. 같은 파일의 `FakeTagService` 와 같은 모양이다.

```ts
import type { Summarizer } from '../../src/clients/summary.ts'

/** 외부 요약 서비스: 정한 요약을 돌려주고 받은 text 를 남긴다. failNext() 면 다음 한 번 실패 */
export class FakeSummarizer implements Summarizer {
  result = '요약 결과'
  readonly received: string[] = []
  #fail = false

  failNext() {
    this.#fail = true
  }

  async summarize(text: string) {
    this.received.push(text)
    if (this.#fail) {
      this.#fail = false
      throw new Error('요약 서비스 연결 실패')
    }
    return this.result
  }

  reset() {
    this.result = '요약 결과'
    this.received.length = 0
    this.#fail = false
  }
}

export const fakeSummarizer = new FakeSummarizer()
```

`servers/notes/tests/support/api.ts` 에서 다른 Fake 와 같은 자리에 넣고, 같은 `reset()` 에서 비운다.

```ts
import { useSummarizer } from '../../src/clients/summary.ts'
import { fakeActivity, fakeSummarizer, fakeTags } from './fakes.ts'

useTags(fakeTags)
useActivity(fakeActivity)
useSummarizer(fakeSummarizer)

async function reset() {
  // ...표를 비우는 코드는 그대로
  fakeTags.reset()
  fakeActivity.reset()
  fakeSummarizer.reset()
}
```

이 공통 설정을 사용하는 테스트는 외부 네트워크를 부르지 않는다. 테스트 파일끼리 DB 를 같이 쓰므로 기존처럼 파일을 하나씩 돌린다(`--test-concurrency=1`).
Fake 는 지정한 결과와 실패만 내놓고, 메모 조회 · 404 판단 · 오류 응답 변환을 다시 구현하지 않는다.

## 4. 실제 HTTP 로 확인한다

`servers/notes/tests/notes/id/summary/GET_specs.ts` 를 만든다. 준비는 storage 의 `create(text, tags)` 로 한다.

```ts
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create, list } from '../../../../src/storage/note.ts'
import { request } from '../../../support/api.ts'
import { fakeSummarizer } from '../../../support/fakes.ts'

describe('GET /api/notes/{id}/summary', () => {
  test('요약을_반환하고_원문은_바꾸지_않는다', async () => {
    const note = await create('저장된 메모 원문', [])
    fakeSummarizer.result = '짧은 요약'

    const res = await request(`/api/notes/${note.id}/summary`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { summary: '짧은 요약' })
    assert.deepEqual(fakeSummarizer.received, [note.text])
    assert.deepEqual(await list(), [note])
  })

  test('외부가_실패하면_502_Bad_Gateway를_반환하고_원문은_바꾸지_않는다', async () => {
    const note = await create('저장된 메모 원문', [])
    fakeSummarizer.failNext()

    const res = await request(`/api/notes/${note.id}/summary`)

    assert.equal(res.status, 502)
    assert.deepEqual(res.body, { error: '요약 서비스 연결 실패' })
    assert.deepEqual(await list(), [note])
  })

  test('없는_메모면_404_Not_Found를_반환하고_외부를_부르지_않는다', async () => {
    const res = await request('/api/notes/999999999/summary')

    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: '메모가 없습니다' })
    assert.deepEqual(fakeSummarizer.received, [])
    assert.deepEqual(await list(), [])
  })
})
```

```bash
pnpm infra
(cd servers/notes && node --test tests/notes/id/summary/GET_specs.ts)   # 이 파일만
pnpm --filter @app/notes test
pnpm --filter @app/notes format
pnpm gen
pnpm typecheck
pnpm lint
```

세 시나리오와 기존 테스트가 통과하고 생성된 계약에 새 경로가 나오면 완료다.
`pnpm gen` 은 새 API 를 정의에서 꺼내는 단계이지, 외부 서비스를 호출하는 단계가 아니다.
