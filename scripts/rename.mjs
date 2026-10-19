// 템플릿으로 만든 저장소에서 한 번: 사람에게 보이는 이름과 slug 를 바꾸고 이 스크립트는 스스로 지운다
//   pnpm rename "My Shop"            slug 는 표시 이름에서 만든다 (my-shop)
//   pnpm rename "가계부" gagyebu      표시 이름이 영문이 아니면 slug 를 준다
//   node scripts/rename.mjs --check  아래 목록이 모두 파일에 그대로 있는지만 본다 (CI)
// 저장소 안에서만 쓰는 이름(@app/* · Java · proto 패키지 · DB 계정)은 바꾸지 않는다 (docs/development.md "이름 바꾸기")
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

// 템플릿의 지금 이름 · slug. 템플릿 이름을 바꾸면 여기만 고친다
const FROM = ['iStack', 'initializer-stack']

// [파일, (이름, slug) → 파일에 꼭 한 번 있는 문자열]. 지금 이름으로 찾아 새 이름으로 바꾼다
const title = (n) => `<title>${n}</title>`
// README 의 배너는 템플릿의 그림이라 새 이름으로는 글자 제목을 쓴다
const banner = `<a href="https://stack.initializer.org"><img src="https://stack.initializer.org/banner.png" alt="${FROM[0]} — 여러 언어의 서버 · 클라이언트를 계약 하나로 잇는 모노레포 템플릿" /></a>`
const targets = [
  ['README.md', (n) => (n === FROM[0] ? banner : `<h1>${n}</h1>`)],
  ['AGENTS.md', (n) => `# ${n}\n`],
  ['DESIGN.md', (n) => `\nname: ${n}\n`],
  ['DESIGN.md', (n) => `# ${n} 디자인\n`],
  ['package.json', (_, s) => `"name": "${s}"`],
  ['docker/docker-compose.middleware.yaml', (_, s) => `\nname: ${s}\n`],
  ['docker/docker-compose.yaml', (_, s) => `\nname: ${s}\n`],
  ['clients/apps/lite/index.html', title],
  ['clients/apps/lite/index.html', (n) => `<h1>${n}</h1>`],
  ['clients/apps/web/index.html', title],
  ['clients/apps/admin/index.html', title],
  ['clients/apps/desktop/index.html', title],
  ['clients/apps/site/app/layout.tsx', (n) => `title: '${n}'`],
  ['clients/apps/mobile/app.json', (n) => `"name": "${n}"`],
  ['clients/apps/mobile/app.json', (_, s) => `"slug": "${s}-mobile"`],
  ['clients/apps/desktop/src-tauri/tauri.conf.json', (n) => `"productName": "${n}"`],
  ['clients/apps/desktop/src-tauri/tauri.conf.json', (n) => `"title": "${n}"`],
  ['clients/apps/desktop/src-tauri/tauri.conf.json', (_, s) => `"identifier": "${s}.desktop"`],
]

const root = new URL('../', import.meta.url)
const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const check = process.argv[2] === '--check'
const [name, given] = check ? FROM : process.argv.slice(2)
if (!name) fail('사용: pnpm rename "<표시 이름>" [slug]')
// HTML · JSON · TS 문자열에 그대로 넣으므로 이스케이프가 필요한 글자는 받지 않는다
if (/[<>&"'\\\n]/.test(name)) fail('표시 이름에 < > & " \' \\ 줄바꿈은 쓸 수 없다')
const slug = given ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// npm 패키지 · compose 프로젝트 · Expo slug · Tauri identifier 에 모두 맞는 모양
if (!/^[a-z][a-z0-9-]*$/.test(slug)) fail(`slug 는 영소문자로 시작하고 영소문자 · 숫자 · - 만 (받은 값: "${slug}"). 예: pnpm rename "가계부" gagyebu`)

// 모두 찾은 뒤에만 쓴다 (하나라도 없으면 아무것도 바꾸지 않는다). pnpm drop 으로 뺀 앱의 파일은 건너뛴다
const dropped = (file) => {
  const app = file.match(/^clients\/apps\/[^/]+\//)?.[0]
  return app !== undefined && !existsSync(new URL(app, root))
}
const files = new Map()
const missing = []
const active = targets.filter(([file]) => !dropped(file))
for (const [file, at] of active) {
  const from = at(...FROM)
  const text = files.get(file) ?? readFileSync(new URL(file, root), 'utf8')
  if (text.split(from).length !== 2) missing.push(`${file}: ${JSON.stringify(from)}`)
  else files.set(file, text.replace(from, () => at(name, slug)))
}
if (missing.length) fail(`찾지 못했다 (이미 바꿨거나 템플릿이 바뀌었다):\n  ${missing.join('\n  ')}`)
if (check) {
  console.log(`ok: ${active.length}곳`)
  process.exit(0)
}

// 한 번만 쓰는 도구라 package.json 의 rename 스크립트와 이 파일을 지운다
const pkg = JSON.parse(files.get('package.json'))
delete pkg.scripts.rename
files.set('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
for (const [file, text] of files) writeFileSync(new URL(file, root), text)
rmSync(new URL('scripts/rename.mjs', root))
if (readdirSync(new URL('scripts/', root)).length === 0) rmSync(new URL('scripts/', root), { recursive: true })

console.log(`${active.length}곳을 바꿨다: "${name}" · ${slug}`)
console.log(`compose 프로젝트 이름이 바뀌어 Postgres 볼륨도 새로 만든다 (예전 것: docker volume rm ${FROM[1]}_db)`)
