import { createServer, type IncomingMessage } from 'node:http'
import { z } from 'zod'
import { BadRequest, NotFound } from '../../support/errors.ts'
import { match, mergeRoutes, type Route } from '../../support/route.ts'
import * as note from './note.ts'

z.config(z.locales.ko())

// HTTP 라우트 표. openapi 문서(src/openapi.ts → contract/openapi/notes.json)도 이 표에서 만든다
export const routes = mergeRoutes(note.routes)

/** JSON 본문만 받는다 (form 같은 단순 요청으로는 못 보내게). 256KB 까지 */
async function json(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new BadRequest('JSON 본문이 필요합니다')
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req as AsyncIterable<Buffer>) {
    if ((size += c.length) > 256_000) throw new BadRequest('본문이 너무 큽니다')
    chunks.push(c)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new BadRequest('JSON 형식이 아닙니다')
  }
}

function parse(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new BadRequest(z.prettifyError(parsed.error))
  return parsed.data
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const found = match(routes, url.pathname)
  const method = req.method?.toLowerCase() as keyof Route
  const e = found && Object.hasOwn(found.route, method) && found.route[method]
  let code = 200,
    body: unknown
  try {
    if (!found) [code, body] = [404, { error: 'not found' }]
    else if (!e) [code, body] = [405, { error: 'method not allowed' }]
    else {
      const params = e.params ? parse(e.params, found.params) : found.params
      const input = e.body && parse(e.body, await json(req))
      body = await e.handler({ params, body: input })
      code = e.status
    }
  } catch (err) {
    // 오류 메시지를 그대로 내보낸다 (밖에 열면 502 는 감추고 로그로)
    ;[code, body] = [
      err instanceof BadRequest ? 400 : err instanceof NotFound ? 404 : 502,
      { error: err instanceof Error ? err.message : String(err) },
    ]
  }
  // 204 처럼 본문이 없으면 비운다
  if (body === undefined) res.writeHead(code).end()
  else
    res
      .writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify(body))
})
