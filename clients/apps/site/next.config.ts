import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dockerfile 만 켠다 (실행에 필요한 파일만 .next/standalone 에). 켜면 next start 가 경고를 낸다
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  partialPrefetching: true,
  // 워크스페이스 패키지는 빌드 없이 .ts 소스로 내보낸다
  transpilePackages: ['@app/client'],
  // 브라우저는 같은 출처 /api/notes 로 부르고, Next 가 notes 서버로 넘긴다 (이 앱이 부르는 서버는 notes 하나).
  // rewrites 주소는 next build 때 정해진다 (NOTES_URL 은 빌드할 때 준다. 서버 컴포넌트는 실행할 때 읽는다)
  async rewrites() {
    return [
      {
        source: '/api/notes/:path*',
        destination: `${process.env.NOTES_URL ?? 'http://127.0.0.1:8000'}/api/notes/:path*`,
      },
    ]
  },
}

export default nextConfig
