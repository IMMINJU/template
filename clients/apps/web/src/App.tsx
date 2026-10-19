import { createClient, type notes, type templates } from '@app/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

// 같은 출처: vite 프록시(이미지는 nginx)가 /api/notes 는 notes 서버로, /api/templates 는 templates 서버로 넘긴다
const api = createClient<notes.paths>({ name: 'notes' })
const notesQuery = api.query('/api/notes')
const templatesQuery = createClient<templates.paths>({
  name: 'templates',
}).query('/api/templates')

export function App() {
  const qc = useQueryClient()
  const { data, error } = useQuery(notesQuery)
  // 쓰고 나면 목록을 다시 받는다
  const onSuccess = () =>
    qc.invalidateQueries({ queryKey: notesQuery.queryKey })
  const add = useMutation({
    mutationFn: (text: string) => api.post('/api/notes', { text }),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: number) =>
      api.delete('/api/notes/{id}', { params: { id } }),
    onSuccess,
  })
  const failure = error ?? add.error ?? remove.error
  // 템플릿은 쓰기를 돕기만 한다: templates 서버가 멈춰 있으면 고르기만 숨기고 메모 쓰기는 그대로
  const { data: picks } = useQuery(templatesQuery)
  const text = useRef<HTMLTextAreaElement>(null)

  return (
    <main>
      <h1>메모</h1>
      {failure && <p role="alert">{failure.message}</p>}
      {data ? (
        <ul>
          {data.notes.map((n) => (
            <li key={n.id} className="card note">
              <p>{n.text}</p>
              <button
                className="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(n.id)}
              >
                삭제
              </button>
              <ul className="tags">
                {n.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        !failure && <p>불러오는 중</p>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          add.mutate(String(new FormData(form).get('text')), {
            onSuccess: () => form.reset(),
          })
        }}
      >
        {picks && picks.templates.length > 0 && (
          <select
            aria-label="템플릿"
            value=""
            onChange={(e) => {
              const picked = picks.templates.find(
                (t) => String(t.id) === e.target.value,
              )
              if (picked && text.current) text.current.value = picked.body
            }}
          >
            <option value="">템플릿으로 시작</option>
            {picks.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <textarea
          ref={text}
          name="text"
          rows={3}
          maxLength={10000}
          required
          aria-label="새 메모"
        />
        <button disabled={add.isPending}>추가</button>
      </form>
    </main>
  )
}
