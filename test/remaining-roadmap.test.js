import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildDuePetCare, confirmPetMedication, migrateInboxToTasks, routineForDate, updateRoutineItem } from '../src/model.js'
import { reconcileSection } from '../src/sync.js'

const noon = value => new Date(`${value}T12:00:00`)

test('a due medication appears once, records who confirmed it, and returns on the next day', () => {
  const data = {
    pets: [{ id: 'pet-1', name: 'Milo', medication: 'Heart tablet', supplies: 'No supply reminder', appointment: 'No appointment scheduled' }],
    tasks: [],
    routines: { confirmations: [] },
  }
  const due = buildDuePetCare(data, noon('2026-11-02'))
  assert.equal(due.length, 1)
  const routines = confirmPetMedication(data.routines, 'pet-1', 'Milo', 'Heart tablet', 'daily', 'Chris', noon('2026-11-02'))
  const retried = confirmPetMedication(routines, 'pet-1', 'Milo', 'Heart tablet', 'daily', 'Ryan', noon('2026-11-02'))
  assert.equal(retried.confirmations.length, 1)
  assert.equal(retried.confirmations[0].confirmedBy, 'Chris')
  assert.equal(buildDuePetCare({ ...data, routines: retried }, noon('2026-11-02')).length, 0)
  assert.equal(buildDuePetCare({ ...data, routines: retried }, noon('2026-11-03')).length, 1)
})

test('routine care resets for a new day and confirmation records the household member', () => {
  const routines = { morning: { time: '8:00 AM', date: '2026-11-01', items: [{ id: 'meal-1', pet: 'Milo', action: 'Breakfast', status: 'given' }] }, confirmations: [] }
  const nextDay = routineForDate(routines.morning, '2026-11-02')
  assert.equal(nextDay.items[0].status, 'open')
  const confirmed = updateRoutineItem(routines, 'morning', 'meal-1', 'given', 'Ryan', noon('2026-11-02'))
  assert.equal(confirmed.morning.items[0].confirmedBy, 'Ryan')
  assert.equal(confirmed.confirmations.length, 1)
  const retry = updateRoutineItem(confirmed, 'morning', 'meal-1', 'given', 'Ryan', noon('2026-11-02'))
  assert.equal(retry.confirmations.length, 1)
})

test('simultaneous care confirmations cannot silently overwrite one another', () => {
  const base = { morning: { items: [] }, confirmations: [] }
  const mine = { ...base, confirmations: [{ id: 'medication:pet-1:daily:2026-11-02', confirmedBy: 'Chris' }] }
  const theirs = { ...base, confirmations: [{ id: 'medication:pet-1:daily:2026-11-02', confirmedBy: 'Ryan' }] }
  assert.deepEqual(reconcileSection(base, mine, theirs), { resolved: false })
})

test('legacy inbox captures migrate to usable Plan tasks without duplication', () => {
  const original = { tasks: [], inbox: [{ id: 'capture-1', text: 'Replace porch bulb', status: 'unorganized', suggestion: { timing: 'Today' } }] }
  const migrated = migrateInboxToTasks(original)
  assert.equal(migrated.tasks.length, 1)
  assert.equal(migrated.tasks[0].date, 'Today')
  assert.equal(migrated.inbox[0].status, 'organized')
  assert.equal(migrateInboxToTasks(migrated).tasks.length, 1)
})

test('remaining roadmap keeps Home factual, Quick Add persistent, and PWA recovery explicit', async () => {
  const [app, serviceWorker, manifest] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(app, /Household knowledge/)
  assert.doesNotMatch(app, /Health suggestions/)
  assert.match(app, /className="quick-add-button"/)
  assert.doesNotMatch(app, /function SuggestionEditor/)
  assert.doesNotMatch(app, /SpeechRecognition/)
  assert.match(app, /Two-week scope review/)
  assert.match(app, /Export household/)
  assert.match(serviceWorker, /SKIP_WAITING/)
  assert.match(serviceWorker, /manifest\.webmanifest/)
  assert.equal(JSON.parse(manifest).display, 'standalone')
})
