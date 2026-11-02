import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Cloud, Flame, Home, KeyRound, LoaderCircle, LogIn, ShieldCheck, UserPlus, Users } from 'lucide-react'
import App from './App'
import { seededData } from './data'
import { apiBaseUrl, getSessionToken, hearthlineApi, setSessionToken } from './api'
import { clearPrivateBrowserState, readPendingChanges, writePendingChanges } from './offline'
import { reconcileSection } from './sync'

function GateShell({ children, accountLabel }) {
  return <main className="cloud-gate">
    <section className="gate-brand"><span><Flame /></span><strong>Hearthline</strong><small>{accountLabel || 'A shared home, held together'}</small></section>
    {children}
  </main>
}

function SetupScreen({ onAuthenticated }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName')).trim()
    const otherAdult = String(form.get('otherAdult')).trim()
    const petNames = String(form.get('petNames') || '').split(',').map(name => name.trim()).filter(Boolean).slice(0, 8)
    try {
      const result = await hearthlineApi.setup({
        setupToken: String(form.get('setupToken')).trim(),
        displayName,
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
        householdName: String(form.get('householdName')).trim(),
        initialData: seededData({ adult1: displayName, adult2: otherAdult, petNames, firstTask: form.get('firstTask') }),
      })
      setSessionToken(result.token)
      await onAuthenticated(result)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <GateShell><section className="gate-card household-gate">
    <span className="gate-icon"><Home /></span>
    <h1>Make Hearthline yours</h1>
    <p>Add the people, pets, and first real task that should appear when your household opens. Nothing fictional will be added.</p>
    <form onSubmit={submit}>
      <label>Private setup code<input name="setupToken" autoComplete="one-time-code" required /></label>
      <label>Household name<input name="householdName" defaultValue="Our home" required /></label>
      <label>Your name<input name="displayName" autoComplete="name" required /></label>
      <label>Other household member<input name="otherAdult" autoComplete="name" required /></label>
      <label>Pet names <span className="optional-label">optional, separated by commas</span><input name="petNames" placeholder="Milo, Luna" /></label>
      <label>First household task<input name="firstTask" placeholder="Choose one useful next action" required /></label>
      <label>Email<input type="email" name="email" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" autoComplete="new-password" minLength="10" required /></label>
      {message && <div className="gate-message">{message}</div>}
      <button className="gate-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Users />}{busy ? 'Creating your household…' : 'Create private household'}</button>
    </form>
    <div className="gate-security"><ShieldCheck /><span>The setup code works only once. Your password is protected with one-way encryption and is never stored as readable text.</span></div>
  </section></GateShell>
}

function AuthScreen({ joinAvailable, onAuthenticated }) {
  const [mode, setMode] = useState('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const payload = {
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    }
    if (mode === 'join') {
      payload.displayName = String(form.get('displayName')).trim()
      payload.inviteCode = String(form.get('inviteCode')).trim().toUpperCase()
    }
    try {
      const result = mode === 'join' ? await hearthlineApi.join(payload) : await hearthlineApi.login(payload)
      setSessionToken(result.token)
      await onAuthenticated(result)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <GateShell><section className="gate-card">
    <span className="gate-icon">{mode === 'signin' ? <Cloud /> : <KeyRound />}</span>
    <h1>{mode === 'signin' ? 'Welcome home' : 'Join your household'}</h1>
    <p>{mode === 'signin' ? 'Sign in to open your private, shared home.' : 'The second person can create the final account using the invite code shown in Settings.'}</p>
    {joinAvailable && <div className="gate-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setMessage('') }}>Sign in</button><button className={mode === 'join' ? 'active' : ''} onClick={() => { setMode('join'); setMessage('') }}>Join with code</button></div>}
    <form onSubmit={submit}>
      {mode === 'join' && <>
        <label>Your display name<input name="displayName" autoComplete="name" required /></label>
        <label>Household invite code<input name="inviteCode" autoCapitalize="characters" autoComplete="one-time-code" minLength="12" required /></label>
      </>}
      <label>Email<input type="email" name="email" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" autoComplete={mode === 'join' ? 'new-password' : 'current-password'} minLength="10" required /></label>
      {message && <div className="gate-message">{message}</div>}
      <button className="gate-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : mode === 'signin' ? <LogIn /> : <UserPlus />}{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create second account'}</button>
    </form>
    <div className="gate-security"><ShieldCheck /><span>Hearthline allows one household and no more than two permanent accounts.</span></div>
  </section></GateShell>
}

function LoadingScreen({ label = 'Opening your household…' }) {
  return <main className="cloud-gate loading-gate"><span className="gate-icon"><LoaderCircle className="spin" /></span><h1>{label}</h1></main>
}

function ConnectionError({ message, retry }) {
  return <main className="cloud-gate loading-gate"><span className="gate-icon"><Cloud /></span><h1>Hearthline couldn’t connect</h1><p>{message}</p><button className="gate-submit" onClick={retry}>Try again <ArrowRight /></button></main>
}

function SharedHousehold({ session, initialData, initialVersions, onSignedOut }) {
  const restoredPending = useRef(readPendingChanges())
  const [remoteData, setRemoteData] = useState(() => {
    const next = structuredClone(initialData)
    for (const [section, change] of restoredPending.current.entries()) next[section] = structuredClone(change.data)
    return next
  })
  const [remoteRevision, setRemoteRevision] = useState(1)
  const [syncStatus, setSyncStatus] = useState(restoredPending.current.size ? 'offline' : 'saved')
  const serverData = useRef(structuredClone(initialData))
  const versions = useRef({ ...initialVersions })
  const pending = useRef(restoredPending.current)
  const conflicts = useRef(new Map())
  const flushing = useRef(false)

  const flushChanges = useCallback(async () => {
    if (flushing.current || !pending.current.size || conflicts.current.size) return
    flushing.current = true
    setSyncStatus('saving')
    try {
      while (pending.current.size) {
        const [section, change] = pending.current.entries().next().value
        try {
          const result = await hearthlineApi.saveSection(section, change.data, change.baseVersion)
          if (pending.current.get(section) === change) pending.current.delete(section)
          writePendingChanges(pending.current)
          serverData.current[section] = structuredClone(result.data)
          versions.current[section] = result.version
        } catch (error) {
          if (error.status !== 409 || error.code !== 'SECTION_CONFLICT') throw error
          const reconciliation = reconcileSection(change.baseData, change.data, error.data)
          serverData.current[section] = structuredClone(error.data)
          versions.current[section] = error.version
          if (reconciliation.resolved) {
            pending.current.set(section, {
              data: structuredClone(reconciliation.data),
              baseData: structuredClone(error.data),
              baseVersion: error.version,
            })
            writePendingChanges(pending.current)
            setRemoteData(current => ({ ...current, [section]: structuredClone(reconciliation.data) }))
            setRemoteRevision(value => value + 1)
            continue
          }
          conflicts.current.set(section, { ...change, remote: structuredClone(error.data), version: error.version })
          setSyncStatus('attention')
          return
        }
      }
      writePendingChanges(pending.current)
      setSyncStatus('saved')
    } catch {
      setSyncStatus('offline')
    } finally {
      flushing.current = false
    }
  }, [])

  const saveChanges = useCallback((nextData) => {
    Object.keys(nextData).forEach(section => {
      const existing = pending.current.get(section)
      const baseline = existing?.data ?? serverData.current[section]
      if (JSON.stringify(baseline) !== JSON.stringify(nextData[section])) {
        pending.current.set(section, {
          data: structuredClone(nextData[section]),
          baseData: existing?.baseData ?? structuredClone(serverData.current[section]),
          baseVersion: existing?.baseVersion ?? versions.current[section],
        })
      }
    })
    writePendingChanges(pending.current)
    flushChanges()
  }, [flushChanges])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const result = await hearthlineApi.data()
        if (!active) return
        const next = structuredClone(result.data)
        for (const [section, change] of pending.current.entries()) next[section] = structuredClone(change.data)
        serverData.current = structuredClone(result.data)
        versions.current = { ...result.versions }
        setRemoteData(next)
        setRemoteRevision(value => value + 1)
        if (!pending.current.size) setSyncStatus('saved')
      } catch (error) {
        if (!active) return
        if (error.status === 401) return onSignedOut()
        setSyncStatus('offline')
      }
    }
    const poll = window.setInterval(refresh, 3000)
    const retry = window.setInterval(flushChanges, 6000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(poll)
      window.clearInterval(retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flushChanges, onSignedOut])

  useEffect(() => {
    if (pending.current.size) flushChanges()
  }, [flushChanges])

  const resolveConflict = useCallback(() => {
    for (const [section, conflict] of conflicts.current.entries()) {
      pending.current.set(section, {
        data: structuredClone(conflict.data),
        baseData: structuredClone(conflict.remote),
        baseVersion: conflict.version,
      })
    }
    conflicts.current.clear()
    writePendingChanges(pending.current)
    setSyncStatus('saving')
    window.setTimeout(flushChanges, 0)
  }, [flushChanges])

  const signOut = useCallback(async () => {
    try { await hearthlineApi.logout() } catch { /* Remove the local session even when offline. */ }
    clearPrivateBrowserState()
    onSignedOut()
  }, [onSignedOut])

  const cloud = useMemo(() => ({
    household: session.household,
    user: session.user,
    status: syncStatus,
    retry: syncStatus === 'attention' ? resolveConflict : flushChanges,
    signOut,
  }), [flushChanges, resolveConflict, session, signOut, syncStatus])

  return <App cloud={cloud} remoteData={remoteData} remoteRevision={remoteRevision} onDataChange={saveChanges} />
}

export default function CloudApp() {
  const [screen, setScreen] = useState({ state: 'loading' })

  const acceptSession = useCallback(async (result) => {
    const latest = await hearthlineApi.data()
    setScreen({ state: 'ready', session: { user: result.user, household: result.household }, data: latest.data, versions: latest.versions })
  }, [])

  const boot = useCallback(async () => {
    setScreen({ state: 'loading' })
    try {
      const status = await hearthlineApi.status()
      if (status.setupRequired) return setScreen({ state: 'setup' })
      if (!getSessionToken()) return setScreen({ state: 'auth', joinAvailable: status.joinAvailable })
      try {
        const [session, data] = await Promise.all([hearthlineApi.session(), hearthlineApi.data()])
        setScreen({ state: 'ready', session, data: data.data, versions: data.versions })
      } catch (error) {
        if (error.status !== 401) throw error
        clearPrivateBrowserState()
        setScreen({ state: 'auth', joinAvailable: status.joinAvailable })
      }
    } catch (error) {
      setScreen({ state: 'error', message: error.message })
    }
  }, [])

  useEffect(() => { boot() }, [boot])

  if (!apiBaseUrl) return <ConnectionError message="The shared service URL has not been configured yet." retry={() => window.location.reload()} />
  if (screen.state === 'loading') return <LoadingScreen />
  if (screen.state === 'error') return <ConnectionError message={screen.message} retry={boot} />
  if (screen.state === 'setup') return <SetupScreen onAuthenticated={acceptSession} />
  if (screen.state === 'auth') return <AuthScreen joinAvailable={screen.joinAvailable} onAuthenticated={acceptSession} />
  return <SharedHousehold session={screen.session} initialData={screen.data} initialVersions={screen.versions} onSignedOut={boot} />
}
