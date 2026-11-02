import test from 'node:test'
import assert from 'node:assert/strict'
import { assignTask, buildPlanEntries, completeTaskWithRecurrence, deferTaskToLater, nextOccurrenceDate, taskFromForm } from '../src/model.js'

const noon = value => new Date(`${value}T12:00:00`)
const recurringTask = (type, extra = {}) => ({
  id: 'task-1', title: 'Water plants', status: 'open', date: '2026-11-02',
  recurrence: { type, ...extra },
})

test('one plan includes each task, event, and unrepresented goal action once', () => {
  const data = {
    tasks: [
      { id: 'task-1', title: 'Call the plumber', status: 'open', date: 'Today', goalId: 'goal-1' },
      { id: 'task-2', title: 'Paint shelves', status: 'open', date: 'Weekend' },
    ],
    goals: [
      { id: 'goal-1', title: 'Fix sink', next: 'Call the plumber', status: 'active' },
      { id: 'goal-2', title: 'Plan garden', next: 'Measure the garden', status: 'active' },
    ],
    events: [{ id: 'event-1', title: 'Dentist', date: '2026-11-05', time: '10:00', private: false }],
  }
  const plan = buildPlanEntries(data, noon('2026-11-01'))
  const all = Object.values(plan).flat()
  assert.equal(all.filter(entry => entry.id === 'task:task-1').length, 1)
  assert.equal(all.filter(entry => entry.id === 'task:task-2').length, 1)
  assert.equal(all.filter(entry => entry.id === 'event:event-1').length, 1)
  assert.equal(all.some(entry => entry.id === 'goal:goal-1'), false)
  assert.equal(all.filter(entry => entry.id === 'goal:goal-2').length, 1)
})

test('recurrence calculates daily, weekly, monthly, and after-completion dates', () => {
  assert.equal(nextOccurrenceDate(recurringTask('daily'), noon('2026-11-02')), '2026-11-03')
  assert.equal(nextOccurrenceDate(recurringTask('weekly'), noon('2026-11-02')), '2026-11-09')
  assert.equal(nextOccurrenceDate(recurringTask('monthly'), noon('2026-11-02')), '2026-12-02')
  assert.equal(nextOccurrenceDate(recurringTask('after-completion', { intervalDays: 10 }), noon('2026-11-04')), '2026-11-14')
})

test('selected-weekday recurrence advances to the next allowed day', () => {
  const task = recurringTask('weekdays', { weekdays: [1, 3] })
  assert.equal(nextOccurrenceDate(task, noon('2026-11-02')), '2026-11-04')
})

test('completing a recurring task creates exactly one next occurrence across retries', () => {
  const first = completeTaskWithRecurrence([recurringTask('daily')], 'task-1', noon('2026-11-02'))
  assert.equal(first.length, 2)
  assert.equal(first.find(task => task.id === 'task-1').status, 'complete')
  assert.equal(first.filter(task => task.id === 'rec-task-1-2026-11-03').length, 1)
  const retry = completeTaskWithRecurrence(first, 'task-1', noon('2026-11-02'))
  assert.deepEqual(retry, first)
})

test('simplified task editing preserves advanced task information', () => {
  const existing = {
    id: 'task-1', title: 'Old title', explanation: 'Old note', category: 'Home', minutes: 45,
    effort: 4, setting: 'outdoor', help: 'professional', cost: '$50', priority: 'must',
    claimedBy: '', status: 'open', date: 'Weekend', timing: 'Morning',
  }
  const form = new FormData()
  form.set('title', 'Updated title')
  form.set('timing', 'This week')
  form.set('owner', 'Chris')
  form.set('notes', 'Bring gloves')
  form.set('recurrence', 'weekly')
  const updated = taskFromForm(form, existing, 'ignored')
  assert.equal(updated.category, 'Home')
  assert.equal(updated.minutes, 45)
  assert.equal(updated.priority, 'must')
  assert.equal(updated.setting, 'outdoor')
  assert.equal(updated.claimedBy, 'Chris')
  assert.equal(updated.date, 'This week')
  assert.equal(updated.recurrence.type, 'weekly')

  form.set('owner', '')
  form.set('notes', '')
  const cleared = taskFromForm(form, updated, 'ignored')
  assert.equal(cleared.claimedBy, '')
  assert.equal(cleared.explanation, '')
})

test('one-tap ownership and defer actions update only the selected task', () => {
  const tasks = [
    { id: 'task-1', title: 'Water plants', status: 'open', date: 'Today', claimedBy: '' },
    { id: 'task-2', title: 'Call plumber', status: 'open', date: 'This week', claimedBy: 'Ryan' },
  ]
  const mine = assignTask(tasks, 'task-1', 'Chris')
  assert.equal(mine[0].claimedBy, 'Chris')
  assert.equal(mine[1].claimedBy, 'Ryan')
  const unassigned = assignTask(mine, 'task-1', 'Chris')
  assert.equal(unassigned[0].claimedBy, '')

  const deferred = deferTaskToLater(mine, 'task-1')
  assert.equal(deferred[0].date, 'Later')
  assert.equal(deferred[0].dueWindow, 'Later')
  assert.equal(deferred[0].timeSensitive, false)
  assert.equal(deferred[1].date, 'This week')
})
