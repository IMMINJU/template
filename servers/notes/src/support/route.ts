import type { z } from 'zod'

/** 메서드 하나. 스키마가 곧 입력 검증이고 openapi 문서다 (src/openapi.ts) */
export interface Endpoint {
  status: 200 | 201 | 204
  /** 경로 변수 (`{id}`). 문자열로 오니 z.coerce 로 바꾼다 */
  params?: z.ZodType
  /** JSON 본문 */
  body?: z.ZodType
  response?: z.ZodType
  handler(req: { params: unknown; body: unknown }): Promise<unknown>
}

/** 경로 하나(`/api/notes/{id}`)의 메서드들 */
export type Route = Partial<Record<'get' | 'post' | 'put' | 'delete', Endpoint>>

type Spec = Pick<Endpoint, 'params' | 'body' | 'response'>
type In<S, K extends keyof Spec> =
  S extends Record<K, infer T extends z.ZodType> ? z.output<T> : undefined
type Out<S> =
  S extends Record<'response', infer R extends z.ZodType> ? z.input<R> : void

/** 검증을 통과한 경로 변수 · 본문만 핸들러에 온다 (모르는 필드는 빠진다). 반환값이 response 와 맞는지 타입으로 검사 */
const method =
  (status: Endpoint['status']) =>
  <S extends Spec>(
    spec: S,
    handler: (req: {
      params: In<S, 'params'>
      body: In<S, 'body'>
    }) => Promise<Out<S>>,
  ) => ({ ...spec, status, handler })

export const get = method(200)
/** 201 Created */
export const post = method(201)
export const put = method(200)
/** 204 No Content (response 없이) */
export const del = method(204)

/** 모듈별 라우트를 합친다. 같은 경로(변수 이름만 다른 것도)가 또 나오면 덮어쓰지 않고 실패한다 */
export function mergeRoutes(...modules: Record<string, Route>[]) {
  const out: Record<string, Route> = {}
  const seen = new Set<string>()
  for (const m of modules)
    for (const [path, route] of Object.entries(m)) {
      const key = path.replace(/\{\w+\}/g, '{}')
      if (seen.has(key)) throw new Error(`라우트 중복: ${path}`)
      seen.add(key)
      out[path] = route
    }
  return out
}

/** 경로 템플릿(`/api/notes/{id}`)에 맞으면 경로 변수 (디코딩하지 않은 문자열) */
function params(path: string, pathname: string) {
  const want = path.split('/')
  const got = pathname.split('/')
  if (want.length !== got.length) return
  const out: Record<string, string> = {}
  for (const [i, w] of want.entries())
    if (w.startsWith('{')) out[w.slice(1, -1)] = got[i]
    else if (w !== got[i]) return
  return out
}

/** 요청 경로의 라우트 · 경로 변수. 변수 없는 경로가 먼저 */
export function match(routes: Record<string, Route>, pathname: string) {
  if (Object.hasOwn(routes, pathname))
    return { route: routes[pathname], params: {} }
  for (const [path, route] of Object.entries(routes)) {
    const p = params(path, pathname)
    if (p) return { route, params: p }
  }
}
