import { createClient, type notes } from '@app/client'

// 서버 컴포넌트는 notes 서버를 직접 부르고, 브라우저는 같은 출처 /api/notes (next.config 의 rewrites → notes) 로 부른다.
// 쿼리 키는 name 으로 같아서 서버에서 미리 받은 데이터가 브라우저 캐시로 이어진다
const api = createClient<notes.paths>({
  name: 'notes',
  base:
    typeof window === 'undefined'
      ? (process.env.NOTES_URL ?? 'http://127.0.0.1:8000')
      : '',
})

export const notesQuery = api.query('/api/notes')
