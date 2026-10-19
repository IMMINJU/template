export const config = {
  // 개발은 이 맥에서만. 컨테이너 등 밖에 열 때 0.0.0.0 (인증 · TLS 먼저)
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8000),
  // 부르는 다른 서버 (gRPC)
  tagsGrpc: process.env.TAGS_GRPC ?? 'http://127.0.0.1:9002',
  activityGrpc: process.env.ACTIVITY_GRPC ?? 'http://127.0.0.1:9001',
}
