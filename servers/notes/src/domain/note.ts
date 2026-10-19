import { activity, type Action } from '../clients/activity.ts'
import { tags } from '../clients/tags.ts'
import { NotFound } from '../support/errors.ts'
import * as notes from '../storage/note.ts'

// 메모 업무 로직. 쓰기 전에 tags 서버가 태그를 매기고, 쓴 뒤 activity 서버에 기록한다
function found<T>(note: T | undefined) {
  if (note === undefined) throw new NotFound('메모가 없습니다')
  return note
}

/** 태그를 못 받으면 저장하지 않는다 (HTTP 502) */
async function suggest(text: string) {
  try {
    return await tags.suggest(text)
  } catch (cause) {
    throw new Error('태그 서버에 연결할 수 없습니다', { cause })
  }
}

/** 기록은 메모 저장을 막지 않는다. 실패하면 경고만 */
async function record(action: Action, id: number) {
  try {
    await activity.record(action, id)
  } catch (e) {
    console.warn(`활동 기록 실패 (${action} ${id}):`, String(e))
  }
}

export const list = () => notes.list()

export async function create(text: string) {
  const note = await notes.create(text, await suggest(text))
  await record('note.created', note.id)
  return note
}

export const get = async (id: number) => found(await notes.find(id))

export async function update(id: number, text: string) {
  const note = found(await notes.update(id, text, await suggest(text)))
  await record('note.updated', id)
  return note
}

export async function remove(id: number) {
  found(await notes.remove(id))
  await record('note.deleted', id)
}
