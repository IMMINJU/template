import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { list, type Note } from '../../src/storage/note.ts'
import { request, sendJson } from '../support/api.ts'
import { fakeActivity, fakeTags } from '../support/fakes.ts'

describe('POST /api/notes', () => {
  test('올바른_메모를_보내면_201_Created와_태그를_매긴_메모를_반환하고_DB에_저장된다', async () => {
    // Arrange
    fakeTags.tags = ['회의', '할일']

    // Act
    const res = await sendJson('POST', '/api/notes', {
      text: '회의 할 일',
      junk: 1,
    })

    // Assert
    assert.equal(res.status, 201)
    const { id } = res.body as Note
    assert.equal(typeof id, 'number')
    const note = { id, text: '회의 할 일', tags: ['회의', '할일'] }
    assert.deepEqual(res.body, note)
    assert.deepEqual(await list(), [note])
    assert.deepEqual(fakeTags.texts, ['회의 할 일'])
  })

  test('저장하면_활동_서버에_note_created와_id를_기록한다', async () => {
    const res = await sendJson('POST', '/api/notes', { text: '안녕' })

    const { id } = res.body as Note
    assert.deepEqual(fakeActivity.records, [
      { action: 'note.created', noteId: id },
    ])
  })

  test('태그_서버에_연결할_수_없으면_502_Bad_Gateway를_반환하고_저장하지_않는다', async () => {
    fakeTags.failNext()

    const res = await sendJson('POST', '/api/notes', { text: '안녕' })

    assert.equal(res.status, 502)
    assert.deepEqual(res.body, { error: '태그 서버에 연결할 수 없습니다' })
    assert.deepEqual(await list(), [])
    assert.deepEqual(fakeActivity.records, [])
  })

  test('활동_서버에_기록하지_못해도_201_Created를_반환하고_DB에_저장된다', async () => {
    fakeActivity.failNext()

    const res = await sendJson('POST', '/api/notes', { text: '안녕' })

    assert.equal(res.status, 201)
    assert.deepEqual(await list(), [res.body])
  })

  test('메모가_문자열이_아니거나_너무_길면_400_Bad_Request를_반환하고_저장하지_않는다', async () => {
    for (const body of [
      null,
      [],
      'x',
      {},
      { text: 1 },
      { text: 'x'.repeat(10_001) },
    ]) {
      const res = await sendJson('POST', '/api/notes', body)

      assert.equal(res.status, 400, JSON.stringify(body))
      assert.equal(typeof (res.body as { error?: unknown }).error, 'string')
    }
    assert.deepEqual(await list(), [])
  })

  test('JSON이_아닌_본문은_400_Bad_Request를_반환한다', async () => {
    const res = await request('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'text=hi',
    })

    assert.equal(res.status, 400)
    assert.deepEqual(res.body, { error: 'JSON 본문이 필요합니다' })
    assert.deepEqual(await list(), [])
  })
})
