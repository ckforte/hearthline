const encoder = new TextEncoder()
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
const PASSWORD_ITERATIONS = 100_000
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const AUTH_WINDOW_MS = 1000 * 60 * 15
const AUTH_ATTEMPT_LIMIT = 10
const MAX_BODY_BYTES = 600_000
const MAX_SECTION_BYTES = 250_000
const PASSWORD_CHALLENGE = encoder.encode('hearthline-password-verifier-v1')
const DATA_SECTIONS = new Set([
  'brandName', 'adults', 'routines', 'tasks', 'capacity', 'events', 'homeProfile',
  'recommendations', 'history', 'pets', 'goals', 'inbox', 'settings',
])

export const householdHasAccountSpace = count => Number(count || 0) < 2

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404, request, env)

    if (request.method === 'OPTIONS') return preflight(request, env)
    if (!originAllowed(request, env)) return json({ error: 'This browser origin is not allowed.' }, 403, request, env)

    try {
      if (request.method === 'GET' && url.pathname === '/api/status') return await getStatus(request, env)
      if (request.method === 'POST' && url.pathname === '/api/setup') return await setupHousehold(request, env, ctx)
      if (request.method === 'POST' && url.pathname === '/api/join') return await joinHousehold(request, env, ctx)
      if (request.method === 'POST' && url.pathname === '/api/login') return await login(request, env, ctx)

      const auth = await authenticate(request, env)
      if (!auth) return json({ error: 'Please sign in again.' }, 401, request, env)

      if (request.method === 'GET' && url.pathname === '/api/session') return json(sessionPayload(auth), 200, request, env)
      if (request.method === 'POST' && url.pathname === '/api/logout') return await logout(request, env, auth)
      if (request.method === 'GET' && url.pathname === '/api/data') return await getData(request, env, auth)
      if (request.method === 'PUT' && url.pathname.startsWith('/api/data/')) {
        const section = decodeURIComponent(url.pathname.slice('/api/data/'.length))
        return await saveSection(request, env, auth, section)
      }
      return json({ error: 'Not found.' }, 404, request, env)
    } catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status, request, env)
      console.error(JSON.stringify({ event: 'request_failed', path: url.pathname, message: error?.message || 'Unknown error' }))
      return json({ error: 'Hearthline could not complete that request.' }, 500, request, env)
    }
  },
}

async function getStatus(request, env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
  const count = Number(row?.count || 0)
  return json({ setupRequired: count === 0, joinAvailable: count === 1 }, 200, request, env)
}

async function setupHousehold(request, env, ctx) {
  const rateKey = await rateLimitKey(request, 'setup')
  if (!(await allowAttempt(env, rateKey))) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, request, env)
  const existing = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
  if (Number(existing?.count || 0) !== 0) return json({ error: 'This household has already been set up.' }, 409, request, env)

  const body = await readJson(request)
  if (!env.SETUP_TOKEN || !(await secretsMatch(String(body.setupToken || ''), env.SETUP_TOKEN))) {
    return json({ error: 'That private setup code is not correct.' }, 403, request, env)
  }
  const account = validateAccount(body)
  const householdName = cleanText(body.householdName, 80)
  if (!householdName) return json({ error: 'Enter a household name.' }, 400, request, env)
  const sections = validateInitialData(body.initialData)

  const householdId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const inviteCode = randomCode(16)
  const password = await createPasswordRecord(account.password)
  const now = Date.now()
  const statements = [
    env.DB.prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)').bind(householdId, householdName, inviteCode, now),
    env.DB.prepare('INSERT INTO users (id, household_id, email, display_name, password_salt, password_verifier, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(userId, householdId, account.email, account.displayName, password.salt, password.verifier, PASSWORD_ITERATIONS, now),
    ...sections.map(([section, data]) => env.DB.prepare('INSERT INTO household_data (household_id, section, data, version, updated_by, updated_at) VALUES (?, ?, ?, 1, ?, ?)').bind(householdId, section, JSON.stringify(data), userId, now)),
  ]
  await env.DB.batch(statements)
  await clearAttempt(env, rateKey)
  const token = await createSession(env, userId)
  ctx.waitUntil(cleanExpired(env))
  console.log(JSON.stringify({ event: 'household_created', householdId, userId }))
  return json({ token, user: publicUser({ id: userId, email: account.email, display_name: account.displayName }), household: { id: householdId, name: householdName, invite_code: inviteCode }, data: Object.fromEntries(sections) }, 201, request, env)
}

async function joinHousehold(request, env, ctx) {
  const body = await readJson(request)
  const account = validateAccount(body)
  const rateKey = await rateLimitKey(request, `join:${account.email}`)
  if (!(await allowAttempt(env, rateKey))) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, request, env)
  const inviteCode = String(body.inviteCode || '').trim().toUpperCase()
  const household = await env.DB.prepare('SELECT id, name, invite_code FROM households WHERE invite_code = ?').bind(inviteCode).first()
  if (!household) return json({ error: 'That household invite code is not valid.' }, 403, request, env)
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE household_id = ?').bind(household.id).first()
  if (!householdHasAccountSpace(count?.count)) return json({ error: 'This household already has its two permanent accounts.' }, 409, request, env)

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(account.email).first()
  if (existing) return json({ error: 'An account already exists for that email.' }, 409, request, env)
  const userId = crypto.randomUUID()
  const password = await createPasswordRecord(account.password)
  await env.DB.prepare('INSERT INTO users (id, household_id, email, display_name, password_salt, password_verifier, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(userId, household.id, account.email, account.displayName, password.salt, password.verifier, PASSWORD_ITERATIONS, Date.now()).run()
  await clearAttempt(env, rateKey)
  const token = await createSession(env, userId)
  const data = await readHouseholdData(env, household.id)
  ctx.waitUntil(cleanExpired(env))
  console.log(JSON.stringify({ event: 'second_account_joined', householdId: household.id, userId }))
  return json({ token, user: publicUser({ id: userId, email: account.email, display_name: account.displayName }), household, data }, 201, request, env)
}

async function login(request, env, ctx) {
  const body = await readJson(request)
  const email = normalizeEmail(body.email)
  const rateKey = await rateLimitKey(request, `login:${email}`)
  if (!(await allowAttempt(env, rateKey))) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, request, env)
  const user = await env.DB.prepare('SELECT id, household_id, email, display_name, password_salt, password_verifier, password_iterations FROM users WHERE email = ? COLLATE NOCASE').bind(email).first()
  const valid = user && await verifyPassword(String(body.password || ''), user)
  if (!valid) return json({ error: 'The email or password is not correct.' }, 401, request, env)
  await clearAttempt(env, rateKey)
  const token = await createSession(env, user.id)
  const household = await env.DB.prepare('SELECT id, name, invite_code FROM households WHERE id = ?').bind(user.household_id).first()
  const data = await readHouseholdData(env, user.household_id)
  ctx.waitUntil(cleanExpired(env))
  return json({ token, user: publicUser(user), household, data }, 200, request, env)
}

async function logout(request, env, auth) {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(auth.tokenHash).run()
  return json({ ok: true }, 200, request, env)
}

async function getData(request, env, auth) {
  const rows = await env.DB.prepare('SELECT section, data, version, updated_at FROM household_data WHERE household_id = ? ORDER BY section').bind(auth.household.id).all()
  const data = {}
  const versions = {}
  let updatedAt = 0
  for (const row of rows.results || []) {
    data[row.section] = JSON.parse(row.data)
    versions[row.section] = row.version
    updatedAt = Math.max(updatedAt, Number(row.updated_at || 0))
  }
  return json({ data, versions, updatedAt }, 200, request, env)
}

export async function saveSection(request, env, auth, section) {
  if (!DATA_SECTIONS.has(section)) return json({ error: 'That data section is not supported.' }, 400, request, env)
  const body = await readJson(request)
  if (!Object.prototype.hasOwnProperty.call(body, 'data')) return json({ error: 'Missing section data.' }, 400, request, env)
  const expectedVersion = Number(body.version)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return json({ error: 'Refresh this section before saving it.' }, 400, request, env)
  const serialized = JSON.stringify(body.data)
  if (encoder.encode(serialized).byteLength > MAX_SECTION_BYTES) return json({ error: 'That section is too large to save.' }, 413, request, env)
  const now = Date.now()
  const result = await env.DB.prepare('UPDATE household_data SET data = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE household_id = ? AND section = ? AND version = ? RETURNING version')
    .bind(serialized, auth.user.id, now, auth.household.id, section, expectedVersion).first()
  if (!result) {
    const current = await env.DB.prepare('SELECT data, version, updated_at FROM household_data WHERE household_id = ? AND section = ?').bind(auth.household.id, section).first()
    if (!current) return json({ error: 'That data section was not found.' }, 404, request, env)
    return json({
      error: 'Someone else saved a newer change here. Review the latest version before choosing what to keep.',
      code: 'SECTION_CONFLICT',
      section,
      data: JSON.parse(current.data),
      version: Number(current.version),
      updatedAt: Number(current.updated_at || 0),
    }, 409, request, env)
  }
  return json({ section, data: body.data, version: result.version, updatedAt: now }, 200, request, env)
}

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await env.DB.prepare(`SELECT s.token_hash, s.expires_at, u.id AS user_id, u.email, u.display_name, h.id AS household_id, h.name AS household_name, h.invite_code
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN households h ON h.id = u.household_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(tokenHash, Date.now()).first()
  if (!row) return null
  return {
    tokenHash,
    user: { id: row.user_id, email: row.email, display_name: row.display_name },
    household: { id: row.household_id, name: row.household_name, invite_code: row.invite_code },
  }
}

function sessionPayload(auth) {
  return { user: publicUser(auth.user), household: auth.household }
}

function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name }
}

async function createSession(env, userId) {
  const token = randomToken(32)
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_TTL_MS, Date.now()).run()
  return token
}

async function readHouseholdData(env, householdId) {
  const rows = await env.DB.prepare('SELECT section, data FROM household_data WHERE household_id = ?').bind(householdId).all()
  return Object.fromEntries((rows.results || []).map(row => [row.section, JSON.parse(row.data)]))
}

function validateAccount(body) {
  const email = normalizeEmail(body.email)
  const displayName = cleanText(body.displayName, 60)
  const password = String(body.password || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError('Enter a valid email address.')
  if (!displayName) throw new RequestError('Enter a display name.')
  if (password.length < 10 || password.length > 200) throw new RequestError('Use a password with at least 10 characters.')
  return { email, displayName, password }
}

function validateInitialData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('Initial household data is missing.')
  const entries = Object.entries(value)
  if (!entries.length || entries.some(([section]) => !DATA_SECTIONS.has(section))) throw new RequestError('Initial household data is not valid.')
  for (const [, data] of entries) {
    if (encoder.encode(JSON.stringify(data)).byteLength > MAX_SECTION_BYTES) throw new RequestError('Initial household data is too large.')
  }
  return entries
}

async function createPasswordRecord(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = bytesToBase64Url(saltBytes)
  const key = await derivePasswordKey(password, saltBytes, PASSWORD_ITERATIONS)
  const verifier = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, PASSWORD_CHALLENGE)))
  return { salt, verifier }
}

async function verifyPassword(password, user) {
  if (!password || password.length > 200) return false
  const key = await derivePasswordKey(password, base64UrlToBytes(user.password_salt), Number(user.password_iterations))
  return crypto.subtle.verify('HMAC', key, base64UrlToBytes(user.password_verifier), PASSWORD_CHALLENGE)
}

async function derivePasswordKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify'])
}

async function secretsMatch(candidate, expected) {
  if (!candidate || candidate.length > 200) return false
  const expectedKey = await crypto.subtle.importKey('raw', encoder.encode(expected), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const candidateKey = await crypto.subtle.importKey('raw', encoder.encode(candidate), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const challenge = encoder.encode('hearthline-setup-token-v1')
  const signature = await crypto.subtle.sign('HMAC', expectedKey, challenge)
  return crypto.subtle.verify('HMAC', candidateKey, signature, challenge)
}

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0)
  if (length > MAX_BODY_BYTES) throw new RequestError('That request is too large.', 413)
  let body
  try { body = await request.json() } catch { throw new RequestError('Send valid form data.') }
  if (encoder.encode(JSON.stringify(body)).byteLength > MAX_BODY_BYTES) throw new RequestError('That request is too large.', 413)
  return body
}

async function allowAttempt(env, key) {
  const now = Date.now()
  const row = await env.DB.prepare('SELECT attempts, window_start FROM auth_attempts WHERE key = ?').bind(key).first()
  if (!row || now - Number(row.window_start) >= AUTH_WINDOW_MS) {
    await env.DB.prepare('INSERT INTO auth_attempts (key, attempts, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = 1, window_start = excluded.window_start').bind(key, now).run()
    return true
  }
  if (Number(row.attempts) >= AUTH_ATTEMPT_LIMIT) return false
  await env.DB.prepare('UPDATE auth_attempts SET attempts = attempts + 1 WHERE key = ?').bind(key).run()
  return true
}

async function clearAttempt(env, key) {
  await env.DB.prepare('DELETE FROM auth_attempts WHERE key = ?').bind(key).run()
}

async function rateLimitKey(request, scope) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  return sha256(`${scope}:${ip}`)
}

async function cleanExpired(env) {
  const expiredSessions = env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now())
  const expiredAttempts = env.DB.prepare('DELETE FROM auth_attempts WHERE window_start <= ?').bind(Date.now() - AUTH_WINDOW_MS * 2)
  await env.DB.batch([expiredSessions, expiredAttempts])
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254)
}

function cleanText(value, limit) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit)
}

function randomToken(size) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)))
}

function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

function configuredOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true
  return configuredOrigins(env).includes(origin)
}

function originAllowed(request, env) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
  return isAllowedOrigin(request.headers.get('Origin'), env)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const headers = { Vary: 'Origin' }
  if (origin && isAllowedOrigin(origin, env)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function preflight(request, env) {
  const origin = request.headers.get('Origin')
  if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: {
    ...corsHeaders(request, env),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
  } })
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...corsHeaders(request, env),
  } })
}

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
