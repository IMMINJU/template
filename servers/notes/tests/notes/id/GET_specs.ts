import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create, remove } from '../../../src/storage/note.ts'
import { request } from '../../support/api.ts'

describe('GET /api/notes/{id}', () => {
  test('저장된_메모를_반환한다', async () => {
    // Arrange
    const note = await create('안녕', ['인사'])

    // Act
    const res = await request(`/api/notes/${note.id}`)

    // Assert
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, note)
  })

  test('없는_id면_404_Not_Found를_반환한다', async () => {
    const { id } = await create('지울 메모', [])
    await remove(id)

    const res = await request(`/api/notes/${id}`)

    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: '메모가 없습니다' })
  })

  test('id가_숫자가_아니면_400_Bad_Request를_반환한다', async () => {
    for (const id of ['abc', '1.5', '0', '-1']) {
      const res = await request(`/api/notes/${id}`)

      assert.equal(res.status, 400, id)
      assert.equal(typeof (res.body as { error?: unknown }).error, 'string')
    }
  })
})
