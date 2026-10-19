// 쓰지 않는 예시 서버 · 앱을 뺀다: 폴더와 그것을 가리키는 설정 줄(gen · contract · DB · compose · smoke · 포트)을 함께 지운다
//   pnpm drop site lite mobile   빼고 나면 pnpm install 로 lockfile 을 정리한다
//   node scripts/drop.mjs --check         남아 있는 서버 · 앱마다 지울 줄이 파일에 그대로 있는지만 본다 (CI)
// 문서(docs · README · AGENTS.md)의 설명은 고치지 않는다. 끝에 남은 언급이 있는 파일을 알려 준다
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'

// 이름 → 전체 스택이 여는 포트. mobile · desktop 은 이미지가 없어 폴더만
const SERVERS = { notes: 8000, activity: 8001, tags: 8002, templates: 8003 }
const APPS = { web: 5280, admin: 5281, site: 5282, lite: 5283, mobile: 0, desktop: 0 }

const root = new URL('../', import.meta.url)
const path = (p) => new URL(p, root)
const read = (p) => readFileSync(path(p), 'utf8')
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

// compose 의 서비스 블록 (`  이름:` 부터 4칸 들여쓴 줄까지). 없으면 그 이름 자체를 돌려줘 "찾지 못했다"로 이어진다
const service = (name) => read('docker/docker-compose.yaml').match(new RegExp(`\\n  ${name}:\\n(    .*\\n)+`))?.[0].slice(1) ?? `  ${name}:`
// smoke.sh 의 덩어리 (`# 이름` 줄부터 빈 줄까지)
const smoke = (name) => read('docker/smoke.sh').match(new RegExp(`\\n# ${name}[:\\n][^]*?\\n\\n`))?.[0].slice(1) ?? `# ${name}`

// 이름 하나 → [파일, 지울 문자열(파일에 꼭 한 번)] 과 지울 경로
function plan(name) {
  const env = `# ${name.toUpperCase()}_PORT=${SERVERS[name] ?? APPS[name]}\n`
  if (name in SERVERS) {
    const edits = [
      ['package.json', ` && pnpm --filter @app/${name} gen`],
      ['contract/index.ts', `export type * as ${name} from './openapi/${name}.ts'\n`],
      ['docker/postgres/init.sql', `CREATE DATABASE ${name};\nCREATE DATABASE ${name}_test;\n`],
      ['docker/docker-compose.yaml', service(name)],
      ['docker/smoke.sh', smoke(name)],
      ['docker/.env.example', env],
    ]
    // 만든 것을 끝에서 지우는 줄
    if (name === 'notes') edits.push(['docker/smoke.sh', 'gone "$notes/$id"\n'])
    if (name === 'tags') edits.push(['docker/smoke.sh', 'gone "$rules/$rule"\n'])
    if (name === 'templates') edits.push(['docker/smoke.sh', 'gone "$templates/$template"\n'])
    return { dir: `servers/${name}`, edits, remove: [`servers/${name}`, `contract/openapi/${name}.json`, `contract/openapi/${name}.ts`] }
  }
  const edits = APPS[name] ? [['docker/docker-compose.yaml', service(name)], ['docker/smoke.sh', smoke(name)], ['docker/.env.example', env]] : []
  return { dir: `clients/apps/${name}`, edits, remove: [`clients/apps/${name}`] }
}

const check = process.argv[2] === '--check'
const known = [...Object.keys(SERVERS), ...Object.keys(APPS)]
const present = known.filter((n) => existsSync(path(plan(n).dir)))
const names = check ? present : [...new Set(process.argv.slice(2))]
if (!names.length) fail(`사용: pnpm drop <이름...>   (남은 것: ${present.join(' ')})`)
const unknown = names.filter((n) => !present.includes(n))
if (unknown.length) fail(`없는 서버 · 앱: ${unknown.join(' ')} (남은 것: ${present.join(' ')})`)

// 남는 것이 부르는 서버는 빼지 않는다: 앱은 createClient<서버.paths> (그 앱의 프록시 · compose depends_on 도 같이 있다), 서버는 <서버>_GRPC 환경 변수
const source = (dir) =>
  readdirSync(path(dir), { recursive: true })
    .filter((f) => /\.(tsx?|vue|py|java|go)$/.test(f) && !/node_modules|\.venv|build\/|gen\//.test(f))
    .map((f) => read(`${dir}/${f}`))
    .join('\n')
const staying = present.filter((n) => !names.includes(n))
for (const server of names.filter((n) => n in SERVERS && !check)) {
  const env = server.toUpperCase()
  const callers = staying.filter((n) =>
    n in APPS
      ? new RegExp(`\\b${server}\\.paths\\b`).test(source(`clients/apps/${n}`))
      : source(`servers/${n}`).includes(`${env}_GRPC`),
  )
  if (callers.length) fail(`${callers.join(' · ')} 가 ${server} 를 부른다. 함께 빼거나 그 호출을 고친 뒤 다시 돌린다`)
}

// 모두 찾은 뒤에만 쓴다 (하나라도 없으면 아무것도 바꾸지 않는다)
const files = new Map()
const missing = []
const plans = names.map(plan)
for (const { edits } of plans)
  for (const [file, text] of edits) {
    const body = files.get(file) ?? read(file)
    if (body.split(text).length !== 2) missing.push(`${file}: ${JSON.stringify(text)}`)
    else files.set(file, body.replace(text, ''))
  }
for (const { remove } of plans) for (const p of remove) if (!existsSync(path(p))) missing.push(p)
if (missing.length) fail(`찾지 못했다 (템플릿이 바뀌었으면 scripts/drop.mjs 의 목록도 고친다):\n  ${missing.join('\n  ')}`)
if (check) {
  console.log(`ok: ${names.join(' ')}`)
  process.exit(0)
}

// 개발 기본 조합(dev 의 --filter)에서도 뺀다. 남은 것이 없으면 전부 띄운다
const pkg = JSON.parse(files.get('package.json') ?? read('package.json'))
for (const n of names) pkg.scripts.dev = pkg.scripts.dev.replace(` --filter @app/${n}`, '')
pkg.scripts.dev = pkg.scripts.dev.replace('pnpm --parallel dev', 'pnpm -r --parallel dev')
files.set('package.json', `${JSON.stringify(pkg, null, 2)}\n`)

// 블록을 지운 자리의 빈 줄이 겹치지 않게
for (const [file, body] of files) writeFileSync(path(file), body.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n'))
for (const { remove } of plans) for (const p of remove) rmSync(path(p), { recursive: true, force: true })

// 설명 문서는 사람이 고친다: 남은 언급이 있는 파일만 알려 준다 (ADR 은 기록이라 그대로 둔다)
const docs = ['README.md', 'AGENTS.md', 'DESIGN.md', 'docs']
const walk = (p) => (statSync(path(p)).isDirectory() ? readdirSync(path(p)).flatMap((f) => walk(`${p}/${f}`)) : [p])
const mentions = docs
  .filter((p) => existsSync(path(p)))
  .flatMap(walk)
  .filter((f) => f.endsWith('.md') && !f.startsWith('docs/decisions/') && names.some((n) => new RegExp(`\\b${n}\\b`).test(read(f))))

console.log(`뺐다: ${names.join(' ')}. 이제 pnpm install 로 lockfile 을 정리한다`)
if (mentions.length) console.log(`설명에 남은 언급 (직접 고친다):\n  ${mentions.join('\n  ')}`)
