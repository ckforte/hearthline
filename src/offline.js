export const SESSION_KEY = 'hearthline-session-v1'
export const HOUSEHOLD_CACHE_KEY = 'hearthline-state-v1'
export const PENDING_CHANGES_KEY = 'hearthline-pending-v1'

export function readPendingChanges(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(PENDING_CHANGES_KEY) || '[]')
    return new Map(Array.isArray(saved) ? saved : [])
  } catch {
    return new Map()
  }
}

export function writePendingChanges(changes, storage = localStorage) {
  if (changes.size) storage.setItem(PENDING_CHANGES_KEY, JSON.stringify([...changes.entries()]))
  else storage.removeItem(PENDING_CHANGES_KEY)
}

export function clearPrivateBrowserState(storage = localStorage) {
  storage.removeItem(SESSION_KEY)
  storage.removeItem(HOUSEHOLD_CACHE_KEY)
  storage.removeItem(PENDING_CHANGES_KEY)
}
