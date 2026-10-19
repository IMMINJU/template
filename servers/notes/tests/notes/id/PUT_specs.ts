import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create, find, list, remove } from '../../../src/storage/note.ts'
import { sendJson } from '../../support/api.ts'
import { fakeActivity, fakeTags } from '../../support/fakes.ts'

describe('PUT /api/notes/{id}', () => {
  test('올바른_메모를_보내면_200_OK와_태그를_다시_매긴_메모를_반환하고_DB에_저장된다', async () => {
    // Arrange
    const { id } = await create('회의', ['회의'])
    fakeTags.tags = ['버그']

    // Act
    const res = await sendJson('PUT', `/api/notes/${id}`, {
      text: '버그',
      junk: 1,
    })

    // Assert
    assert.equal(res.status, 200)
    const note = { id, text: '버그', tags: ['버그'] }
    assert.deepEqual(res.body, note)
    assert.deepEqual(await find(id), note)
    assert.deepEqual(fakeTags.texts, ['버그'])
  })

  test('고치면_활동_서버에_note_updated와_id를_기록한다', async () => {
    const { id } = await create('전', [])

    await sendJson('PUT', `/api/notes/${id}`, { text: '후' })

    assert.deepEqual(fakeActivity.records, [
      { action: 'note.updated', noteId: id },
    ])
  })

  test('태그_서버에_연결할_수_없으면_502_Bad_Gateway를_반환하고_고치지_않는다', async () => {
    const note = await create('전', ['옛'])
    fakeTags.failNext()

    const res = await sendJson('PUT', `/api/notes/${note.id}`, { text: '후' })

    assert.equal(res.status, 502)
    assert.deepEqual(res.body, { error: '태그 서버에 연결할 수 없습니다' })
    assert.deepEqual(await find(note.id), note)
    assert.deepEqual(fakeActivity.records, [])
  })

  test('없는_id면_404_Not_Found를_반환한다', async () => {
    const { id } = await create('지울 메모', [])
    await remove(id)

    const res = await sendJson('PUT', `/api/notes/${id}`, { text: '후' })

    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: '메모가 없습니다' })
    assert.deepEqual(await list(), [])
    assert.deepEqual(fakeActivity.records, [])
  })

  test('메모가_문자열이_아니거나_너무_길면_400_Bad_Request를_반환하고_고치지_않는다', async () => {
    const note = await create('전', [])

    for (const body of [
      null,
      [],
      'x',
      {},
      { text: 1 },
      { text: 'x'.repeat(10_001) },
    ]) {
      const res = await sendJson('PUT', `/api/notes/${note.id}`, body)

      assert.equal(res.status, 400, JSON.stringify(body))
      assert.equal(typeof (res.body as { error?: unknown }).error, 'string')
    }
    assert.deepEqual(await find(note.id), note)
  })
})
