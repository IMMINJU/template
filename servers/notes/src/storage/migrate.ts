import { join } from 'node:path'
import { runner } from 'node-pg-migrate'
import { connection } from './db.ts'

/** migrations/ 의 SQL 중 아직 안 한 것을 순서대로 적용한다 (한 것은 pgmigrations 표). 서버 · 테스트가 listen 전에 부른다 */
export const migrate = () =>
  runner({
    databaseUrl: connection(),
    dir: join(import.meta.dirname, '../../migrations'),
    migrationsTable: 'pgmigrations',
    direction: 'up',
  })
