import { z } from 'zod'
import { del, get, post, put } from '../../support/route.ts'
import * as notes from '../../domain/note.ts'

// 검증 · 문서가 이 스키마에서 나온다. id 는 이 서버의 openapi 안에서 유일해야 한다
const NoteInput = z
  .object({ text: z.string().max(10_000) })
  .meta({ id: 'NoteInput' })
const Note = z
  .object({
    id: z.int().meta({ format: 'int64' }),
    text: z.string(),
    tags: z.array(z.string()),
  })
  .meta({ id: 'Note' })
const NoteList = z.object({ notes: z.array(Note) }).meta({ id: 'NoteList' })
// 경로 변수는 문서에 parameters 로 풀어 쓰니 이름(id)을 붙이지 않는다
const Id = z.object({
  id: z.coerce.number().int().positive().meta({ format: 'int64' }),
})

export const routes = {
  '/api/notes': {
    get: get({ response: NoteList }, async () => ({
      notes: await notes.list(),
    })),
    post: post({ body: NoteInput, response: Note }, async ({ body }) =>
      notes.create(body.text),
    ),
  },
  '/api/notes/{id}': {
    get: get({ params: Id, response: Note }, async ({ params }) =>
      notes.get(params.id),
    ),
    put: put({ params: Id, body: NoteInput, response: Note }, async (req) =>
      notes.update(req.params.id, req.body.text),
    ),
    delete: del({ params: Id }, async ({ params }) => notes.remove(params.id)),
  },
}
