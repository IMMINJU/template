# 계약을 깨뜨려 보기

*의도한 실패를 만들고, 무엇이 잡고 무엇은 잡지 못하는지 확인한다*

템플릿에서 만든 학습용 저장소를 기준으로 한다. `pnpm install` 을 마쳤고 `pnpm typecheck` 가 통과하는 상태에서 시작한다.
1 · 3 단계는 DB 와 개발 서버 없이 할 수 있다. 생성물은 직접 편집하지 않는다. 명령은 모두 저장소 루트에서 돌린다.

## 1. HTTP 응답의 필드를 바꾼다

`servers/notes/src/api/http/note.ts` 에서 목록 응답에만 쓰는 `NoteList` 의 `notes` 를 `items` 로 바꾼다.

```ts
const NoteList = z.object({ items: z.array(Note) }).meta({ id: 'NoteList' })
```

같은 파일의 `GET /api/notes` 핸들러도 바꾼다. 개별 메모나 POST · PUT 응답은 그대로다.

```ts
get: get({ response: NoteList }, async () => ({
  items: await notes.list(),
})),
```

notes 서버의 문서만 다시 만들고 타입을 검사한다.

```bash
pnpm --filter @app/notes gen
pnpm --filter @app/contract gen:types
pnpm --filter @app/notes typecheck
pnpm --filter @app/web typecheck
```

**예상:** 서버 타입 검사는 통과하고, web 은 이렇게 실패한다.

```
src/App.tsx:31:17 - error TS2339: Property 'notes' does not exist on type '{ items: { id: number; text: string; tags: string[]; }[]; }'.
...
Found 3 errors in the same file, starting at: src/App.tsx:31
```

나머지 두 오류는 `n` · `t` 의 타입을 잃어 따라 나오는 TS7006 이다.
`contract/openapi/notes.json` 과 `notes.ts` 에는 `items` 가 들어 있다. 같은 목록을 읽는 lite · site · mobile · desktop 도 같은 이유로 실패한다.
타입을 손으로 적었거나 생성을 빼먹었다면 클라이언트 검사가 옛 정의를 보게 된다. CI 의 생성물 비교는 그 누락을 잡는 별도의 검사다.

## 2. 현재 클라이언트를 고친다

`clients/apps/web/src/App.tsx` 에서 목록을 그리는 한 줄을 바꾼다.

```tsx
{data.items.map((n) => (
```

```bash
pnpm --filter @app/web typecheck
```

**예상:** 이제 통과한다. 하지만 이미 배포된 옛 앱은 여전히 `notes` 를 읽는다.
이 실습은 **현재 소스의 타입 불일치**를 잡았을 뿐, 옛 앱과의 호환이나 실제 응답 값까지 증명하지 않는다.
notes 의 `tests/notes/GET_specs.ts` 는 응답 본문 전체를 비교하므로 그대로 돌리면 실패한다(DB 가 필요하다: `pnpm infra`).
타입 검사와 동작 테스트는 서로를 대신하지 않는다.

실습 뒤에는 서버 스키마와 핸들러의 `items` 를 `notes` 로, web 의 한 줄을 `{data.notes.map((n) => (` 로 되돌린 뒤 `pnpm gen` 을 실행한다.
다른 작업을 덮어쓰는 `git restore .` 대신 자신이 바꾼 줄만 되돌린다.

## 3. proto 의 필드 번호를 바꾼다

이번에는 지금의 계약을 임시 폴더에 복사해 비교 기준으로 삼는다. Git 의 브랜치 상태와 상관없이 이번 변경 직전의 계약과 비교하기 위해서다.
아래 변수와 명령은 같은 터미널에서 실행한다.

```bash
contract_baseline=$(mktemp -d)
cp contract/buf.yaml "$contract_baseline/buf.yaml"
cp -R contract/proto "$contract_baseline/proto"
```

`contract/proto/app/activity/v1/activity.proto` 의 **RecordRequest** 에서 `int64 note_id = 2;` 를 `int64 note_id = 3;` 으로 바꾼다.
`action = 1` 은 바꾸지 않는다. 이 메시지는 notes(Node)가 보내고 activity(Spring)가 받는다.

```bash
pnpm --filter @app/contract exec buf lint
pnpm --filter @app/contract exec buf breaking --against "$contract_baseline"
```

**예상:** lint 는 통과하지만 breaking 은 실패한다. 문법과 이름 규칙을 지키는 것과 기존 계약과 호환되는 것은 다르다.

```
proto/app/activity/v1/activity.proto:13:1:Previously present field "2" with name "note_id" on message "RecordRequest" was deleted.
```

정확한 문구는 Buf 버전에 따라 다르다. 옛 notes 가 2번에 담아 보낸 id 를 새 activity 는 3번에서 찾는다. 3번은 비어 0 이 되니,
배포가 섞이는 동안 기록이 `INVALID_ARGUMENT` 로 거절되고 notes 는 경고만 남긴다. 그래도 테스트는 모두 통과한다.

`int64 note_id = 2;` 로 되돌리고 같은 breaking 명령을 다시 실행하면 통과해야 한다.
실습에서는 생성 코드를 사용하지 않으므로 proto 만 검사했다. 실제 변경에서는 `pnpm gen` 과 서버 테스트도 함께 실행한다.

CI 도 `buf breaking` 을 실행한다. PR · merge queue 는 대상 브랜치의 기준 커밋, main push 는 push 직전 커밋과 비교한다.
비교할 커밋이 checkout 에 없는 첫 push · force push 는 건너뛴다.
이 검사는 proto 의 구조적 호환만 보며, 같은 문자열 필드의 뜻을 바꾸는 것까지는 알아내지 못한다.

## 4. 원래 상태로 확인한다

```bash
pnpm gen
pnpm typecheck
pnpm test
git diff
```

테스트에는 Docker 의 Postgres 가 필요하다. 실습 변경과 생성물이 원래대로 돌아왔는지 diff 에서 확인한다.
그다음 [외부 서비스 실패 테스트](external-service-lab.md)에서 실제 서버 · DB 와 Fake 의 경계를 확인한다.
