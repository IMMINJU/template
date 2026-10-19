import { createClient, type notes } from '@app/client'
import { fetch } from '@tauri-apps/plugin-http'
import './style.css'

// 창은 tauri:// 출처라 서버를 직접 부르면 CORS 에 막힌다. Rust 쪽 HTTP 플러그인으로 부른다.
// 주소를 바꾸면 src-tauri/capabilities/default.json 의 허용 URL 도 같이
const api = createClient<notes.paths>({ base: 'http://127.0.0.1:8000', fetch })

const list = document.querySelector<HTMLUListElement>('#notes')!
const form = document.querySelector<HTMLFormElement>('#add')!
const input = form.querySelector('textarea')!
const err = document.querySelector<HTMLParagraphElement>('#err')!
// API 응답 문자열은 textContent 로만 (innerHTML 금지)
const show = (e: unknown) => {
  err.hidden = false
  err.textContent = e instanceof Error ? e.message : String(e)
}

// 목록을 받아 다시 그린다
async function load() {
  const { notes } = await api.get('/api/notes')
  list.replaceChildren(
    ...notes.map(({ id, text, tags }) => {
      const li = document.createElement('li')
      const p = document.createElement('p')
      const del = document.createElement('button')
      const chips = document.createElement('ul')
      li.className = 'card note'
      p.textContent = text
      del.className = 'danger'
      del.textContent = '삭제'
      del.onclick = () =>
        write(del, () => api.delete('/api/notes/{id}', { params: { id } }))
      chips.className = 'tags'
      chips.append(
        ...tags.map((textContent) =>
          Object.assign(document.createElement('li'), { textContent }),
        ),
      )
      li.append(p, del, chips)
      return li
    }),
  )
}

// 쓰는 동안 버튼을 막고, 끝나면 목록을 다시 받는다
async function write(button: HTMLButtonElement, send: () => Promise<unknown>) {
  button.disabled = true
  try {
    await send()
    await load()
    err.hidden = true
  } catch (e) {
    show(e)
  } finally {
    button.disabled = false
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  void write(form.querySelector('button')!, async () => {
    await api.post('/api/notes', { text: input.value })
    form.reset()
  })
})
load().catch(show)
