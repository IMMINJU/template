import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create, list, remove } from '../../../src/storage/note.ts'
import { request } from '../../support/api.ts'
import { fakeActivity } from '../../support/fakes.ts'

describe('DELETE /api/notes/{id}', () => {
  test('저장된_메모를_지우면_204_No_Content를_반환하고_DB에서_지워진다', async () => {
    // Arrange
    const note = await create('지울 메모', [])
    const other = await create('남을 메모', ['남음'])

    // Act
    const res = await request(`/api/notes/${note.id}`, { method: 'DELETE' })

    // Assert
    assert.equal(res.status, 204)
    assert.equal(res.body, undefined)
    assert.deepEqual(await list(), [other])
  })

  test('지우면_활동_서버에_note_deleted와_id를_기록한다', async () => {
    const { id } = await create('지울 메모', [])

    await request(`/api/notes/${id}`, { method: 'DELETE' })

    assert.deepEqual(fakeActivity.records, [
      { action: 'note.deleted', noteId: id },
    ])
  })

  test('없는_id면_404_Not_Found를_반환한다', async () => {
    const { id } = await create('지울 메모', [])
    await remove(id)

    const res = await request(`/api/notes/${id}`, { method: 'DELETE' })

    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: '메모가 없습니다' })
    assert.deepEqual(fakeActivity.records, [])
  })
})
