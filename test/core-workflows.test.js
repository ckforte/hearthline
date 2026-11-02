import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getSessionToken, setSessionToken } from '../src/api.js'
import { clearPrivateBrowserState, HOUSEHOLD_CACHE_KEY, PENDING_CHANGES_KEY, readPendingChanges, SESSION_KEY, writePendingChanges } from '../src/offline.js'
import { completeTaskWithRecurrence, confirmRoutine, taskFromForm, upsertTask } from '../src/model.js'
import { householdHasAccountSpace } from '../worker/index.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('a household accepts exactly two permanent accounts', () => {
  assert.equal(householdHasAccountSpace(0), true)
  assert.equal(householdHasAccountSpace(1), true)
  assert.equal(householdHasAccountSpace(2), false)
  assert.equal(householdHasAccountSpace(3), false)
})

test('sign-in is retained and sign-out clears private browser state', () => {
  const storage = new MemoryStorage()
  globalThis.localStorage = storage
  setSessionToken('private-session')
  storage.setItem(HOUSEHOLD_CACHE_KEY, '{"private":true}')
  storage.setItem(PENDING_CHANGES_KEY, '[["tasks",{}]]')
  assert.equal(getSessionToken(), 'private-session')

  clearPrivateBrowserState(storage)
  assert.equal(storage.getItem(SESSION_KEY), null)
  assert.equal(storage.getItem(HOUSEHOLD_CACHE_KEY), null)
  assert.equal(storage.getItem(PENDING_CHANGES_KEY), null)
})

test('offline changes survive a reload until they are saved or signed out', () => {
  const storage = new MemoryStorage()
  const pending = new Map([['tasks', { data: [{ id: 'task-1', title: 'Offline task' }], baseData: [], baseVersion: 1 }]])
  writePendingChanges(pending, storage)
  const restored = readPendingChanges(storage)
  assert.deepEqual(restored.get('tasks'), pending.get('tasks'))
  writePendingChanges(new Map(), storage)
  assert.equal(storage.getItem(PENDING_CHANGES_KEY), null)
})

test('a task can be created and completed', () => {
  const form = new FormData()
  form.set('title', 'Replace hallway bulb')
  form.set('timing', 'Today')
  const task = taskFromForm(form, null, 'task-1')
  const created = upsertTask([], task)
  assert.equal(created.length, 1)
  assert.equal(created[0].status, 'open')
  const completed = completeTaskWithRecurrence(created, 'task-1')
  assert.equal(completed[0].status, 'complete')
})

test('a recurring care routine requires and records confirmation', () => {
  const routines = { morning: { time: '8:00 AM', items: [{ id: 'dose-1', pet: 'Milo', status: 'open' }] } }
  const confirmed = confirmRoutine(routines, 'morning')
  assert.equal(confirmed.morning.items[0].status, 'given')
  assert.equal(routines.morning.items[0].status, 'open')
})

test('critical controls remain present in the 390px mobile layout', async () => {
  const [styles, app] = await Promise.all([
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(styles, /@media \(max-width: 760px\)/)
  assert.match(styles, /\.task-actions \{ position: relative; display: block; \}/)
  assert.match(styles, /\.modal, \.modal\.wide \{ width: 100%; max-height: 92vh;/)
  assert.match(app, /className="mobile-header"/)
  assert.match(app, /aria-label="Gentle reminders"/)
})

test('service records do not create temporary attachment URLs', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /URL\.createObjectURL/)
  assert.doesNotMatch(app, /type="file"/)
  assert.match(app, /stores text records only/)
})
