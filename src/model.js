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

export function assignTask(tasks, taskId, person) {
  return tasks.map(task => task.id === taskId
    ? { ...task, claimedBy: task.claimedBy === person ? '' : person }
    : task)
}

export function deferTaskToLater(tasks, taskId) {
  return tasks.map(task => task.id === taskId
    ? { ...task, status: 'open', date: 'Later', dueWindow: 'Later', timeSensitive: false }
    : task)
}

export function toggleTaskCompletion(tasks, taskId) {
  return tasks.map(task => task.id === taskId
    ? { ...task, status: task.status === 'complete' ? 'open' : 'complete' }
    : task)
}

const toDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

export function migrateInboxToTasks(data) {
  const pending = (data.inbox || []).filter(item => item.status !== 'organized')
  if (!pending.length) return data
  const next = structuredClone(data)
  next.tasks ||= []
  next.inbox ||= []
  const existingIds = new Set((next.tasks || []).map(task => task.id))
  for (const item of pending) {
    const id = `quick-${item.id}`
    if (!existingIds.has(id)) {
      const suggestedTiming = item.suggestion?.timing
      const date = suggestedTiming === 'Today' ? 'Today' : suggestedTiming?.toLowerCase().includes('month') ? 'Later' : 'This week'
      next.tasks.push({
        id, title: item.text, explanation: '', category: 'Household', minutes: 15, effort: 1,
        dueWindow: date, timing: 'Flexible', setting: 'indoor', help: 'either', cost: '',
        priority: 'should', claimedBy: '', status: 'open', date, timeSensitive: date === 'Today',
      })
      existingIds.add(id)
    }
  }
  next.inbox = next.inbox.map(item => item.status === 'organized' ? item : { ...item, status: 'organized', migratedToPlan: true })
  return next
}

export function routineForDate(routine, dateKey = toDateKey(new Date())) {
  if (routine.date === dateKey) return routine
  return { ...routine, date: dateKey, items: routine.items.map(item => ({ ...item, status: 'open', confirmedBy: undefined, confirmedAt: undefined })) }
}

function confirmationId(kind, parts, dateKey) {
  return `${kind}:${parts.join(':')}:${dateKey}`
}

function addConfirmation(routines, record) {
  const confirmations = routines.confirmations || []
  return confirmations.some(item => item.id === record.id) ? routines : { ...routines, confirmations: [...confirmations, record] }
}

export function confirmPetMedication(routines, petId, petName, medication, slot, confirmedBy, confirmedAt = new Date()) {
  const dateKey = toDateKey(new Date(confirmedAt))
  const id = confirmationId('medication', [petId, slot], dateKey)
  return addConfirmation(routines, { id, type: 'medication', petId, pet: petName, action: medication, slot, date: dateKey, confirmedBy, confirmedAt: new Date(confirmedAt).toISOString() })
}

export function buildDuePetCare(data, now = new Date()) {
  const dateKey = toDateKey(new Date(now))
  const confirmations = new Set((data.routines?.confirmations || []).map(item => item.id))
  const items = []
  for (const pet of data.pets || []) {
    const medication = String(pet.medication || '').trim()
    if (medication && !/^no current medication$/i.test(medication)) {
      const slots = /morning.*evening|evening.*morning|twice/i.test(medication) ? ['morning', 'evening'] : ['daily']
      for (const slot of slots) {
        const confirmation = confirmationId('medication', [pet.id, slot], dateKey)
        if (!confirmations.has(confirmation)) items.push({ id: confirmation, type: 'medication', petId: pet.id, pet: pet.name, title: medication, detail: slot === 'daily' ? 'Due today' : `${slot[0].toUpperCase()}${slot.slice(1)} dose`, slot })
      }
    }
    const supplies = String(pet.supplies || '').trim()
    if (supplies && !/^no supply reminder$/i.test(supplies) && !(data.tasks || []).some(task => task.sourcePetSupplyId === pet.id && task.sourcePetSupplyTitle === supplies)) {
      items.push({ id: `supply:${pet.id}`, type: 'supply', petId: pet.id, pet: pet.name, title: supplies, detail: 'Supply need' })
    }
    const appointment = String(pet.appointment || '').trim()
    if (appointment && !/^no appointment scheduled$/i.test(appointment)) items.push({ id: `appointment:${pet.id}`, type: 'appointment', petId: pet.id, pet: pet.name, title: appointment, detail: 'Upcoming appointment' })
  }
  return items
}

export function updateRoutineItem(routines, period, itemId, status, confirmedBy = '', confirmedAt = new Date()) {
  const dateKey = toDateKey(new Date(confirmedAt))
  const current = routineForDate(routines[period], dateKey)
  const target = current.items.find(item => item.id === itemId)
  let next = { ...routines, [period]: { ...current, items: current.items.map(item => item.id === itemId ? { ...item, status, confirmedBy: status === 'given' ? confirmedBy : undefined, confirmedAt: status === 'given' ? new Date(confirmedAt).toISOString() : undefined } : item) } }
  if (status === 'given' && target) {
    const id = confirmationId('routine', [period, itemId], dateKey)
    next = addConfirmation(next, { id, type: 'routine', period, itemId, pet: target.pet, action: target.action, date: dateKey, confirmedBy, confirmedAt: new Date(confirmedAt).toISOString() })
  }
  return next
}

export function confirmRoutine(routines, period, confirmedBy = '', confirmedAt = new Date()) {
  const dateKey = toDateKey(new Date(confirmedAt))
  const current = routineForDate(routines[period], dateKey)
  let next = { ...routines, [period]: { ...current, items: current.items.map(item => ({ ...item, status: 'given', confirmedBy, confirmedAt: new Date(confirmedAt).toISOString() })) } }
  for (const item of current.items) {
    const id = confirmationId('routine', [period, item.id], dateKey)
    next = addConfirmation(next, { id, type: 'routine', period, itemId: item.id, pet: item.pet, action: item.action, date: dateKey, confirmedBy, confirmedAt: new Date(confirmedAt).toISOString() })
  }
  return next
}
