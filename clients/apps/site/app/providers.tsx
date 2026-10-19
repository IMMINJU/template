'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  // 탭마다 하나. staleTime: 서버에서 미리 받은 데이터를 화면에 붙자마자 다시 받지 않게
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
