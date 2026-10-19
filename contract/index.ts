// 서버별 HTTP API 타입. 각 서버가 코드에서 만든 openapi/<서버>.json 을 `pnpm gen` 이 openapi/<서버>.ts 로 바꾼다
// (둘 다 직접 고치지 않음). 문서를 하나로 합치지 않는다: 서버끼리 같은 이름(Note 같은 스키마 이름)이 있어도 네임스페이스로 갈린다
export type * as notes from './openapi/notes.ts'
export type * as tags from './openapi/tags.ts'
export type * as activity from './openapi/activity.ts'
export type * as templates from './openapi/templates.ts'
