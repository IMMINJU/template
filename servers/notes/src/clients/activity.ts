import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { ActivityService } from '@app/contract/gen/app/activity/v1/activity_pb.js'
import { config } from '../config.ts'

export type Action = 'note.created' | 'note.updated' | 'note.deleted'

/** activity 서버: 메모를 쓸 때마다 남기는 기록 */
export interface Activity {
  record(action: Action, noteId: number): Promise<void>
}

// 만들 때는 접속하지 않는다 (처음 부를 때 연결). 서버가 멈춰도 쓰기가 계속 기다리지 않게 시간 제한
const client = createClient(
  ActivityService,
  createGrpcTransport({
    baseUrl: config.activityGrpc,
    defaultTimeoutMs: 3_000,
  }),
)
const grpcActivity: Activity = {
  record: async (action, noteId) => {
    await client.record({ action, noteId: BigInt(noteId) })
  },
}

export let activity: Activity = grpcActivity
/** 테스트가 Fake 로 바꿀 때만 쓴다 */
export const useActivity = (a: Activity) => (activity = a)
