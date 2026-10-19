import assert from 'node:assert/strict'
import { test } from 'node:test'
import { match, mergeRoutes } from '../../src/support/route.ts'

test('같은_경로가_두_모듈에_있으면_덮어쓰지_않고_실패한다', () => {
  const a = { '/api/x': {}, '/api/x/{id}': {} }
  assert.deepEqual(Object.keys(mergeRoutes(a, { '/api/y': {} })), [
    '/api/x',
    '/api/x/{id}',
    '/api/y',
  ])
  assert.throws(() => mergeRoutes(a, { '/api/x': {} }), /라우트 중복/)
  // 변수 이름만 달라도 같은 경로다
  assert.throws(() => mergeRoutes(a, { '/api/x/{xId}': {} }), /라우트 중복/)
})

test('경로_템플릿은_변수를_한_칸씩_뽑고_변수_없는_경로가_먼저_맞는다', () => {
  const routes = { '/api/x/{id}': {}, '/api/x/new': {} }

  const byId = match(routes, '/api/x/7')
  assert.equal(byId?.route, routes['/api/x/{id}'])
  assert.deepEqual(byId?.params, { id: '7' })
  assert.equal(match(routes, '/api/x/new')?.route, routes['/api/x/new'])
  assert.equal(match(routes, '/api/x/7/y'), undefined)
  assert.equal(match(routes, '/api/x'), undefined)
})
