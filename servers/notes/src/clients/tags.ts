import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { TagService } from '@app/contract/gen/app/tag/v1/tag_pb.js'
import { config } from '../config.ts'

/** tags 서버: 메모 내용에 맞는 태그 */
export interface Tags {
  suggest(text: string): Promise<string[]>
}

// 만들 때는 접속하지 않는다 (처음 부를 때 연결). 서버가 멈춰도 쓰기가 계속 기다리지 않게 시간 제한
const client = createClient(
  TagService,
  createGrpcTransport({ baseUrl: config.tagsGrpc, defaultTimeoutMs: 3_000 }),
)
const grpcTags: Tags = {
  suggest: async (text) => (await client.suggest({ text })).tags,
}

export let tags: Tags = grpcTags
/** 테스트가 Fake 로 바꿀 때만 쓴다 */
export const useTags = (t: Tags) => (tags = t)
