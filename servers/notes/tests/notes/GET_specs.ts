import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { create } from '../../src/storage/note.ts'
import { request } from '../support/api.ts'

describe('GET /api/notes', () => {
  test('저장된_메모를_만든_순서대로_반환한다', async () => {
    // Arrange
    const first = await create('하나', ['회의'])
    const second = await create('둘', [])

    // Act
    const res = await request('/api/notes')

    // Assert
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { notes: [first, second] })
  })

  test('메모가_없으면_빈_목록을_반환한다', async () => {
    const res = await request('/api/notes')

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { notes: [] })
  })
})
