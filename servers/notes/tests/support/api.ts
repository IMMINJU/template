// 모든 API 테스트의 공통 설정. import 하면 이 파일(= 테스트 프로세스 하나)에서:
// - 테스트 DB(notes_test, `pnpm infra` 의 Postgres)에 마이그레이션을 적용하고, 테스트마다 앞뒤로 비운다
// - 다른 서버(tags · activity) 자리에 Fake 를 넣고, 테스트마다 앞뒤로 비운다
// - 실제 HTTP 서버를 랜덤 포트로 띄우고, 끝나면 닫는다
// 테스트 파일은 프로세스가 따로라 서버 · Fake 를 서로 나누지 않는다. DB 는 같이 쓰므로 파일을 하나씩 돌린다 (--test-concurrency=1)
import type { AddressInfo } from 'node:net'
import { after, afterEach, beforeEach } from 'node:test'
import { server } from '../../src/api/http/server.ts'
import { useActivity } from '../../src/clients/activity.ts'
import { useTags } from '../../src/clients/tags.ts'
import { db } from '../../src/storage/db.ts'
import { migrate } from '../../src/storage/migrate.ts'
import { fakeActivity, fakeTags } from './fakes.ts'

process.env.PGDATABASE = 'notes_test'
await migrate()
useTags(fakeTags)
useActivity(fakeActivity)

await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
after(async () => {
  server.close()
  await db().end()
})

// 마이그레이션 기록(pgmigrations)은 남긴다. id(IDENTITY)는 되돌리지 않으니 테스트는 돌려받은 id 를 쓴다
async function reset() {
  const tables = await db()`SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> 'pgmigrations'`
  if (tables.length)
    await db()`TRUNCATE ${db()(tables.map((t) => t.tablename))}`
  fakeTags.reset()
  fakeActivity.reset()
}
beforeEach(reset)
afterEach(reset)

/** 실제 HTTP 요청. 응답 본문은 JSON 으로 읽는다 (204 처럼 비었으면 undefined) */
export async function request(path: string, init?: RequestInit) {
  const r = await fetch(base + path, init)
  const text = await r.text()
  return {
    status: r.status,
    body: (text ? JSON.parse(text) : undefined) as unknown,
  }
}

/** JSON 본문 POST · PUT */
export const sendJson = (method: 'POST' | 'PUT', path: string, body: unknown) =>
  request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
