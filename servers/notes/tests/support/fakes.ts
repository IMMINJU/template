// 다른 서버(gRPC) 대역. api.ts 가 교체 지점에 한 번 넣고 테스트마다 reset() 한다
import type { Action, Activity } from '../../src/clients/activity.ts'
import type { Tags } from '../../src/clients/tags.ts'

const unreachable = () => new Error('연결할 수 없음')

/** tags 서버: 정한 태그를 돌려주고 받은 text 를 남긴다. failNext() 면 다음 한 번 실패 */
export class FakeTagService implements Tags {
  tags: string[] = []
  readonly texts: string[] = []
  #fail = false

  failNext() {
    this.#fail = true
  }

  async suggest(text: string) {
    if (this.#fail) {
      this.#fail = false
      throw unreachable()
    }
    this.texts.push(text)
    return this.tags
  }

  reset() {
    this.tags = []
    this.texts.length = 0
    this.#fail = false
  }
}

/** activity 서버: 받은 기록을 남긴다. failNext() 면 다음 한 번 실패 */
export class FakeActivityService implements Activity {
  readonly records: { action: Action; noteId: number }[] = []
  #fail = false

  failNext() {
    this.#fail = true
  }

  async record(action: Action, noteId: number) {
    if (this.#fail) {
      this.#fail = false
      throw unreachable()
    }
    this.records.push({ action, noteId })
  }

  reset() {
    this.records.length = 0
    this.#fail = false
  }
}

export const fakeTags = new FakeTagService()
export const fakeActivity = new FakeActivityService()
