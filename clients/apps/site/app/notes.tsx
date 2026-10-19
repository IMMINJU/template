'use client'

import { useQuery } from '@tanstack/react-query'
import { notesQuery } from './api'

// 읽기 전용: 서버에서 미리 받은 목록을 그대로 이어받고, 오래되면 브라우저가 다시 받는다
export function Notes() {
  const { data, error } = useQuery(notesQuery)

  return (
    <>
      {error && <p role="alert">{error.message}</p>}
      {data ? (
        <ul>
          {data.notes.map((n) => (
            <li key={n.id} className="card note">
              <p>{n.text}</p>
              <ul className="tags">
                {n.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        !error && <p>불러오는 중</p>
      )}
    </>
  )
}
