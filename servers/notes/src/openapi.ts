// `pnpm gen`: 라우트 표(zod 스키마) → contract/openapi/notes.json. 클라이언트 타입은 이 문서에서 만든다
import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { routes } from './api/http/server.ts'
import type { Endpoint } from './support/route.ts'

const ApiError = z.object({ error: z.string() }).meta({ id: 'Error' })

const ref = (s: z.ZodType) => {
  const id = z.globalRegistry.get(s)?.id
  if (!id) throw new Error('라우트 스키마는 .meta({ id }) 로 이름을 붙인다')
  return { $ref: `#/components/schemas/${id}` }
}
const json = (s: z.ZodType) => ({ 'application/json': { schema: ref(s) } })
const res = (description: string, s: z.ZodType) => ({
  description,
  content: json(s),
})
const fail = (description: string) => res(description, ApiError)
const ok = { 200: 'OK', 201: '만듦', 204: '본문 없음' }

/** 경로 변수 스키마(z.object)의 필드 하나 = path parameter 하나 */
const parameters = (s: z.ZodType) =>
  Object.keys((s as z.ZodObject).shape).map((name) => {
    const { $schema: _, ...schema } = z.toJSONSchema(
      (s as z.ZodObject).shape[name]!,
    )
    return { name, in: 'path', required: true, schema }
  })

const operation = (e: Endpoint) => ({
  ...(e.params && { parameters: parameters(e.params) }),
  ...(e.body && {
    requestBody: { required: true, content: json(e.body) },
  }),
  responses: {
    [e.status]: e.response
      ? res(ok[e.status], e.response)
      : { description: ok[e.status] },
    ...((e.params || e.body) && { 400: fail('잘못된 요청') }),
    // 경로 변수로 찾는 것은 없을 수 있다 (NotFound)
    ...(e.params && { 404: fail('없음') }),
    502: fail('서버 · 외부 서비스 오류'),
  },
})

const paths = Object.fromEntries(
  Object.entries(routes).map(([path, route]) => [
    path,
    Object.fromEntries(
      Object.entries(route).map(([method, e]) => [method, operation(e)]),
    ),
  ]),
)

// 이름 있는 스키마 전부 (같은 id 가 둘이면 여기서 실패한다)
const { schemas } = z.toJSONSchema(z.globalRegistry, {
  uri: (id) => `#/components/schemas/${id}`,
})
for (const s of Object.values(schemas)) {
  delete s.$schema
  delete s.$id
}

const doc = {
  openapi: '3.1.0',
  info: { title: 'notes', version: '0.0.0' },
  paths,
  components: { schemas },
}
const out = new URL('../../../contract/openapi/notes.json', import.meta.url)
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n')
