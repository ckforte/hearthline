import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileSection } from '../src/sync.js'
import { saveSection } from '../worker/index.js'

function testEnvironment(initialData) {
  const row = { data: JSON.stringify(initialData), version: 1, updated_at: 1 }
  return {
    row,
    env: {
      ALLOWED_ORIGINS: '',
      DB: {
        prepare(sql) {
          return {
            bind(...values) {
              return {
                async first() {
                  if (sql.startsWith('UPDATE household_data')) {
                    const [data, , updatedAt, , , expectedVersion] = values
                    if (row.version !== expectedVersion) return null
                    row.data = data
                    row.version += 1
                    row.updated_at = updatedAt
                    return { version: row.version }
                  }
                  if (sql.startsWith('SELECT data, version')) return { ...row }
                  return null
                },
              }
            },
          }
        },
      },
    },
  }
}

const auth = { user: { id: 'user-1' }, household: { id: 'home-1' } }
const saveRequest = (data, version) => new Request('https://example.test/api/data/tasks', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data, version }),
})

test('a stale section save is rejected without replacing newer data', async () => {
  const { env, row } = testEnvironment([{ id: 'task-1', title: 'Original' }])
  const newer = [{ id: 'task-1', title: 'Newer change' }]
  const first = await saveSection(saveRequest(newer, 1), env, auth, 'tasks')
  assert.equal(first.status, 200)

  const stale = await saveSection(saveRequest([{ id: 'task-1', title: 'Stale change' }], 1), env, auth, 'tasks')
  assert.equal(stale.status, 409)
  const conflict = await stale.json()
  assert.equal(conflict.code, 'SECTION_CONFLICT')
  assert.equal(conflict.version, 2)
  assert.deepEqual(conflict.data, newer)
  assert.deepEqual(JSON.parse(row.data), newer)
})

test('compatible additions from two people reconcile without duplication', () => {
  const base = [{ id: 'task-1', title: 'Existing' }]
  const mine = [...base, { id: 'task-2', title: 'Mine' }]
  const theirs = [...base, { id: 'task-3', title: 'Theirs' }]
  const result = reconcileSection(base, mine, theirs)
  assert.equal(result.resolved, true)
  assert.deepEqual(result.data.map(item => item.id), ['task-1', 'task-3', 'task-2'])
})

test('competing edits to the same item require attention', () => {
  const base = [{ id: 'task-1', title: 'Original' }]
  const result = reconcileSection(base, [{ id: 'task-1', title: 'Mine' }], [{ id: 'task-1', title: 'Theirs' }])
  assert.equal(result.resolved, false)
})
