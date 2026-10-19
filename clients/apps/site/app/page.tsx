import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { Suspense } from 'react'
import { notesQuery } from './api'
import { Notes } from './notes'

export default function Page() {
  return (
    <main>
      <h1>메모</h1>
      <Suspense fallback={<p>불러오는 중</p>}>
        <Prefetched />
      </Suspense>
    </main>
  )
}

// 요청마다 서버에서 미리 받아 HTML 에 담는다. 실패하면 브라우저가 다시 받고 오류를 보여준다
async function Prefetched() {
  const qc = new QueryClient()
  await qc.prefetchQuery(notesQuery)
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Notes />
    </HydrationBoundary>
  )
}
