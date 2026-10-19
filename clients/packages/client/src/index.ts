// TS 클라이언트 공용 fetch. 부를 서버마다 하나씩 만든다: createClient<notes.paths>({ base })
// 타입은 그 서버가 코드에서 만든 openapi 문서(@app/contract)에서 온다. 경로마다 생기는 코드가 없어서
// API 가 늘어도 번들 크기는 같다
export type * from '@app/contract'

type Method = 'get' | 'post' | 'put' | 'delete'
type Query = Record<string, string>
type Json<R> = R extends { content: { 'application/json': infer T } }
  ? T
  : never

/** 메서드 M 이 있는 경로 */
type With<T, M extends Method> = {
  [P in keyof T]: T[P] extends Record<M, object> ? P : never
}[keyof T] &
  string
type Op<T, P extends keyof T, M extends Method> =
  T[P] extends Record<M, infer O> ? O : never
/** 응답 본문: 200 · 201 의 JSON, 204 는 void */
type Res<O> = O extends { responses: { 200: infer R } }
  ? Json<R>
  : O extends { responses: { 201: infer R } }
    ? Json<R>
    : void
type Body<O> = O extends { requestBody?: infer B }
  ? Json<NonNullable<B>>
  : never
/** 경로에 {id} 같은 칸이 있으면 params 가 꼭 있어야 하고, 없으면 못 넣는다 */
type Opts<O> = O extends { parameters: { path: infer X extends object } }
  ? [opts: { params: X; query?: Query }]
  : [opts?: { params?: never; query?: Query }]
type Options = { params?: object; query?: Query }

/**
 * 서버 하나의 클라이언트. T = 그 서버의 paths (예: notes.paths)
 * - name: TanStack Query 키의 첫 칸. 같은 경로를 가진 서버가 둘이어도 캐시가 섞이지 않게
 * - base: 같은 출처(웹 + 프록시)면 생략, 네이티브 앱 · 서버 렌더링은 서버 주소
 * - fetch: Tauri 는 CORS 없는 플러그인 fetch
 */
export function createClient<T>({
  name = '',
  base = '',
  fetch: send = (input, init) => fetch(input, init),
}: { name?: string; base?: string; fetch?: typeof fetch } = {}) {
  // 쓰기는 JSON 본문만. JSON 이어야 다른 사이트의 몰래 보내는 요청이 브라우저 사전 확인(preflight)에서 막힌다
  async function call(
    method: string,
    path: string,
    { params = {}, query }: Options = {},
    body?: unknown,
  ) {
    // /api/notes/{id} 의 {id} 를 params 로 채운다
    const url =
      path.replace(/\{(\w+)\}/g, (_, k: string) =>
        encodeURIComponent(String((params as Record<string, unknown>)[k])),
      ) + (query ? `?${new URLSearchParams(query)}` : '')
    const r = await send(
      base + url,
      body === undefined
        ? { method }
        : {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
    )
    if (!r.ok) throw await failure(r)
    return r.status === 204 ? undefined : r.json()
  }

  const get = <P extends With<T, 'get'>>(
    path: P,
    ...[opts]: Opts<Op<T, P, 'get'>>
  ) => call('GET', path, opts) as Promise<Res<Op<T, P, 'get'>>>

  const post = <P extends With<T, 'post'>>(
    path: P,
    body: Body<Op<T, P, 'post'>>,
    ...[opts]: Opts<Op<T, P, 'post'>>
  ) => call('POST', path, opts, body) as Promise<Res<Op<T, P, 'post'>>>

  const put = <P extends With<T, 'put'>>(
    path: P,
    body: Body<Op<T, P, 'put'>>,
    ...[opts]: Opts<Op<T, P, 'put'>>
  ) => call('PUT', path, opts, body) as Promise<Res<Op<T, P, 'put'>>>

  const del = <P extends With<T, 'delete'>>(
    path: P,
    ...[opts]: Opts<Op<T, P, 'delete'>>
  ) => call('DELETE', path, opts) as Promise<Res<Op<T, P, 'delete'>>>

  /**
   * TanStack Query 옵션 (React · Vue 공용): useQuery(api.query('/api/notes')).
   * 키 = [name, 경로, params, query]. 앞부분이 같으면 함께 무효화된다
   */
  const query = <P extends With<T, 'get'>>(
    path: P,
    ...[opts]: Opts<Op<T, P, 'get'>>
  ) => ({
    queryKey: [name, path, opts?.params ?? {}, opts?.query ?? {}] as const,
    queryFn: () => call('GET', path, opts) as Promise<Res<Op<T, P, 'get'>>>,
  })

  return { get, post, put, delete: del, query }
}

// API 서버가 꺼져 있으면 프록시가 JSON 이 아닌 응답을 준다
async function failure(r: Response) {
  const d = (await r.json().catch(() => null)) as { error?: string } | null
  return new Error(d?.error || `API 오류 (HTTP ${r.status})`)
}
