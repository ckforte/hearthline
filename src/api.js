const SESSION_KEY = 'hearthline-session-v1'
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const apiBaseUrl = configuredApiUrl

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY) || ''
}

export function setSessionToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token)
  else localStorage.removeItem(SESSION_KEY)
}

async function request(path, options = {}) {
  const token = getSessionToken()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${configuredApiUrl}${path}`, { ...options, headers })
  } catch {
    throw new Error('Hearthline could not reach the shared service. Check your connection and try again.')
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error || 'Something went wrong while connecting to Hearthline.')
    error.status = response.status
    error.code = body.code
    error.section = body.section
    error.data = body.data
    error.version = body.version
    throw error
  }
  return body
}

export const hearthlineApi = {
  status: () => request('/api/status'),
  session: () => request('/api/session'),
  setup: (payload) => request('/api/setup', { method: 'POST', body: JSON.stringify(payload) }),
  join: (payload) => request('/api/join', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/api/logout', { method: 'POST' }),
  data: () => request('/api/data'),
  saveSection: (section, data, version) => request(`/api/data/${encodeURIComponent(section)}`, {
    method: 'PUT',
    body: JSON.stringify({ data, version }),
  }),
}
