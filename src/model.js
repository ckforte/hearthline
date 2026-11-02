export function taskFromForm(form, existing = null, id) {
  return {
    id: existing?.id || id,
    title: form.get('title'),
    explanation: form.get('explanation'),
    category: form.get('category'),
    minutes: Number(form.get('minutes')) || 15,
    effort: Number(form.get('effort')) || 1,
    dueWindow: form.get('dueWindow'),
    timing: form.get('timing'),
    setting: form.get('setting'),
    help: form.get('help'),
    cost: form.get('cost'),
    priority: form.get('priority'),
    claimedBy: existing?.claimedBy || '',
    status: existing?.status || 'open',
    date: form.get('date'),
    timeSensitive: form.get('timeSensitive') === 'on',
    goalId: existing?.goalId,
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
