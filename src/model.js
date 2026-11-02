export function taskFromForm(form, existing = null, id) {
  const timing = form.get('timing') || existing?.date || 'This week'
  const recurrenceType = form.get('recurrence') || existing?.recurrence?.type || 'none'
  const weekdays = form.getAll('weekdays').map(Number).filter(day => day >= 0 && day <= 6)
  return {
    id: existing?.id || id,
    title: form.get('title'),
    explanation: form.has('notes') ? form.get('notes') : existing?.explanation || '',
    category: existing?.category || 'Household',
    minutes: existing?.minutes || 15,
    effort: existing?.effort || 1,
    dueWindow: timing,
    timing: existing?.timing || 'Flexible',
    setting: existing?.setting || 'indoor',
    help: existing?.help || 'either',
    cost: existing?.cost || '',
    priority: existing?.priority || 'should',
    claimedBy: form.has('owner') ? form.get('owner') : existing?.claimedBy || '',
    status: existing?.status || 'open',
    date: timing,
    timeSensitive: timing === 'Today',
    goalId: existing?.goalId,
    recurrence: recurrenceType === 'none' ? null : {
      type: recurrenceType,
      weekdays: recurrenceType === 'weekdays' ? (weekdays.length ? weekdays : existing?.recurrence?.weekdays || [1, 2, 3, 4, 5]) : [],
      intervalDays: recurrenceType === 'after-completion' ? Number(form.get('intervalDays') || existing?.recurrence?.intervalDays || 7) : undefined,
    },
  }
}

export function upsertTask(tasks, task) {
  return tasks.some(item => item.id === task.id)
    ? tasks.map(item => item.id === task.id ? task : item)
    : [...tasks, task]
}

export function toggleTaskCompletion(tasks, taskId) {
  return tasks.map(task => task.id === taskId
    ? { ...task, status: task.status === 'complete' ? 'open' : 'complete' }
    : task)
}

const toDateKey = date => date.toISOString().slice(0, 10)
const fromTaskDate = (task, now) => /^\d{4}-\d{2}-\d{2}$/.test(task.date || '') ? new Date(`${task.date}T12:00:00`) : new Date(now)

export function nextOccurrenceDate(task, completedAt = new Date()) {
  if (!task.recurrence?.type) return null
  const next = fromTaskDate(task, completedAt)
  const type = task.recurrence.type
  if (type === 'daily') next.setDate(next.getDate() + 1)
  if (type === 'weekly') next.setDate(next.getDate() + 7)
  if (type === 'monthly') next.setMonth(next.getMonth() + 1)
  if (type === 'after-completion') {
    const completion = new Date(completedAt)
    next.setTime(completion.getTime())
    next.setDate(next.getDate() + Number(task.recurrence.intervalDays || 7))
  }
  if (type === 'weekdays') {
    const allowed = task.recurrence.weekdays?.length ? task.recurrence.weekdays : [1, 2, 3, 4, 5]
    do next.setDate(next.getDate() + 1); while (!allowed.includes(next.getDay()))
  }
  return toDateKey(next)
}

export function completeTaskWithRecurrence(tasks, taskId, completedAt = new Date()) {
  const task = tasks.find(item => item.id === taskId)
  if (!task) return tasks
  if (task.status === 'complete') return tasks
  const completed = tasks.map(item => item.id === taskId ? { ...item, status: 'complete', completedAt: new Date(completedAt).toISOString() } : item)
  const nextDate = nextOccurrenceDate(task, completedAt)
  if (!nextDate) return completed
  const rootId = task.recurrenceRootId || task.id
  const occurrenceId = `rec-${rootId}-${nextDate}`
  if (completed.some(item => item.id === occurrenceId || (item.recurrenceRootId === rootId && item.date === nextDate))) return completed
  return [...completed, {
    ...task,
    id: occurrenceId,
    recurrenceRootId: rootId,
    status: 'open',
    completedAt: undefined,
    date: nextDate,
    dueWindow: nextDate,
    timeSensitive: false,
  }]
}

function planBucketForDate(value, now) {
  if (value === 'Today') return 'today'
  if (['Weekend', 'This week'].includes(value)) return 'week'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'later'
  const date = new Date(`${value}T12:00:00`)
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const days = Math.round((date - start) / 86400000)
  if (days <= 0) return 'today'
  return days <= 7 ? 'week' : 'later'
}

export function buildPlanEntries(data, now = new Date()) {
  const result = { today: [], week: [], later: [], completed: [] }
  for (const task of data.tasks || []) {
    const bucket = task.status === 'complete' ? 'completed' : planBucketForDate(task.date || task.dueWindow, now)
    result[bucket].push({ id: `task:${task.id}`, type: 'task', title: task.title, detail: task.explanation, task })
  }
  const goalsWithTasks = new Set((data.tasks || []).map(task => task.goalId).filter(Boolean))
  for (const goal of data.goals || []) {
    if (goal.status !== 'active' || !goal.next || goalsWithTasks.has(goal.id)) continue
    result.later.push({ id: `goal:${goal.id}`, type: 'goal', title: goal.next, detail: `Next action for ${goal.title}`, goal })
  }
  const todayKey = toDateKey(new Date(now))
  for (const event of data.events || []) {
    if (!event.date || event.date < todayKey) continue
    const bucket = planBucketForDate(event.date, now)
    result[bucket].push({ id: `event:${event.id}`, type: 'event', title: event.private ? 'Private commitment' : event.title, detail: `${event.date}${event.time ? ` at ${event.time}` : ''}`, event })
  }
  return result
}

export function updateRoutineItem(routines, period, itemId, status) {
  return {
    ...routines,
    [period]: {
      ...routines[period],
      items: routines[period].items.map(item => item.id === itemId ? { ...item, status } : item),
    },
  }
}

export function confirmRoutine(routines, period) {
  return {
    ...routines,
    [period]: {
      ...routines[period],
      items: routines[period].items.map(item => ({ ...item, status: 'given' })),
    },
  }
}
