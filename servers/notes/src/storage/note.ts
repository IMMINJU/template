import { db } from './db.ts'

export interface Note {
  id: number
  text: string
  tags: string[]
}

// BIGINT 는 문자열로 온다. JS 정수 범위(2^53) 안이라고 보고 숫자로 바꾼다
type Row = { id: string; text: string; tags: string[] }
const toNote = (r: Row): Note => ({
  id: Number(r.id),
  text: r.text,
  tags: r.tags,
})
/** 첫 행. 없으면 undefined (find · update · remove) */
const first = (rows: Row[]): Note | undefined => rows[0] && toNote(rows[0])

export const list = async () =>
  (await db()<Row[]>`SELECT id, text, tags FROM notes ORDER BY id`).map(toNote)

export async function create(text: string, tags: string[]) {
  const [row] = await db()<
    Row[]
  >`INSERT INTO notes (text, tags) VALUES (${text}, ${tags}) RETURNING id, text, tags`
  return toNote(row)
}

export const find = async (id: number) =>
  first(await db()<Row[]>`SELECT id, text, tags FROM notes WHERE id = ${id}`)

export const update = async (id: number, text: string, tags: string[]) =>
  first(
    await db()<
      Row[]
    >`UPDATE notes SET text = ${text}, tags = ${tags} WHERE id = ${id} RETURNING id, text, tags`,
  )

export const remove = async (id: number) =>
  first(
    await db()<
      Row[]
    >`DELETE FROM notes WHERE id = ${id} RETURNING id, text, tags`,
  )
