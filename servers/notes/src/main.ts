import { server } from './api/http/server.ts'
import { config } from './config.ts'
import { migrate } from './storage/migrate.ts'

// 표를 먼저 맞추고 연다 (실패하면 열지 않고 끝난다)
await migrate()
server.listen(config.port, config.host, () =>
  console.log(`api http://${config.host}:${config.port}`),
)
