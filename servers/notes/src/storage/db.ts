import postgres from 'postgres'

/** PG* 환경 변수 (기본 docker 의 notes DB). 부를 때 읽는다 (테스트가 PGDATABASE 를 바꾼다) */
export function connection() {
  const env = process.env
  return {
    host: env.PGHOST ?? '127.0.0.1',
    port: Number(env.PGPORT ?? 5432),
    database: env.PGDATABASE ?? 'notes',
    user: env.PGUSER ?? 'app',
    password: env.PGPASSWORD ?? 'app',
  }
}

let sql: postgres.Sql | undefined

/**
 * Postgres (docker/docker-compose.middleware.yaml, `pnpm infra`). 처음 부를 때 연결 정보를 읽고 처음 쿼리할 때 연결한다.
 * 표는 migrations/ 가 만든다 (migrate.ts)
 */
export function db() {
  sql ??= postgres(connection())
  return sql
}
