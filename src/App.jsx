import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, ClipboardList, Clock3, CloudSun, Dog, Edit3, Flame, FolderHeart,
  Goal, HeartPulse, Home, Inbox, Info, Leaf, Menu, Mic, MicOff, Minus, Moon, MoreHorizontal,
  PawPrint, Plus, Settings, ShieldCheck, Sparkles, Sun, Trash2, UserRound, Users, Wrench, X,
} from 'lucide-react'
import { seededData } from './data'
import { HOUSEHOLD_CACHE_KEY } from './offline'
import { buildPlanEntries, completeTaskWithRecurrence, confirmRoutine, taskFromForm, updateRoutineItem, upsertTask } from './model'

const NAV_ITEMS = [
  ['today', 'Today', Sun], ['plan', 'Plan', ClipboardList], ['pets', 'Pets', PawPrint], ['home', 'Home', Home],
]

const uid = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const titleCase = (value = '') => value.charAt(0).toUpperCase() + value.slice(1)
const friendlyDate = (date = new Date()) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const shortDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date not set'
const displayClock = (value = '') => {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return value
  const [hours, minutes] = value.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
const timeMinutes = (value = '') => {
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return 0
  let hours = Number(match[1]); const minutes = Number(match[2]); const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}
const capacityLimit = { low: 5, moderate: 9, high: 15 }

function loadState() {
  try {
    const saved = localStorage.getItem(HOUSEHOLD_CACHE_KEY)
    return saved ? JSON.parse(saved) : seededData()
  } catch {
    return seededData()
  }
}

function Button({ children, variant = 'primary', className = '', icon: Icon, ...props }) {
  return <button className={`button ${variant} ${className}`} {...props}>{Icon && <Icon size={16} />}{children}</button>
}

function IconButton({ label, children, className = '', ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>
}

function Chip({ children, tone = 'neutral' }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

function EmptyState({ icon: Icon = CheckCircle2, title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} /></span><h3>{title}</h3><p>{text}</p>{action}</div>
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const preferred = dialog.querySelector('[autofocus]') || focusable()[0]
    preferred?.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section ref={dialogRef} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton label="Close" onClick={onClose}><X size={20} /></IconButton></header>
      {children}
    </section>
  </div>
}

function App({ cloud = null, remoteData = null, remoteRevision = 0, onDataChange = null }) {
  const [data, setData] = useState(() => remoteData ? structuredClone(remoteData) : loadState())
  const [view, setView] = useState('today')
  const [mobileNav, setMobileNav] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [displayMode, setDisplayMode] = useState(null)
  const applyingRemote = useRef(false)

  useEffect(() => {
    if (!remoteData || !remoteRevision) return
    applyingRemote.current = true
    setData(structuredClone(remoteData))
  }, [remoteData, remoteRevision])
  useEffect(() => {
    if (!onDataChange) {
      localStorage.setItem(HOUSEHOLD_CACHE_KEY, JSON.stringify(data))
      return
    }
    localStorage.removeItem(HOUSEHOLD_CACHE_KEY)
    if (applyingRemote.current) { applyingRemote.current = false; return }
    const timer = setTimeout(() => onDataChange(data), 450)
    return () => clearTimeout(timer)
  }, [data, onDataChange])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const update = (recipe) => setData(prev => {
    const next = structuredClone(prev)
    recipe(next)
    return next
  })
  const navigate = (next) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const notify = (message) => setToast(message)

  const completeTask = (taskId) => {
    update(next => { next.tasks = completeTaskWithRecurrence(next.tasks, taskId, new Date()) })
  }
  const claimTask = (taskId, person) => {
    update(next => { const task = next.tasks.find(t => t.id === taskId); if (task) task.claimedBy = task.claimedBy === person ? '' : person })
  }
  const deleteTask = (taskId) => update(next => { next.tasks = next.tasks.filter(t => t.id !== taskId) })
  const saveTask = (form, existing) => update(next => {
    next.tasks = upsertTask(next.tasks, taskFromForm(form, existing, uid('task')))
  })
  const deferTask = (task, reason, suggestion) => update(next => {
    const target = next.tasks.find(t => t.id === task.id)
    if (target) { target.status = 'deferred'; target.deferReason = reason; target.dueWindow = suggestion; target.date = 'Upcoming' }
  })

  const navProps = { data, update, setModal, notify, completeTask, claimTask, deleteTask, navigate, setDisplayMode, cloud }
  const views = {
    today: <TodayView {...navProps} />,
    plan: <PlanView {...navProps} />,
    weekend: <WeekendView {...navProps} />,
    calendar: <CalendarView {...navProps} />,
    home: <HomeView {...navProps} />,
    pets: <PetsView {...navProps} />,
    goals: <GoalsView {...navProps} />,
    inbox: <InboxView {...navProps} />,
    settings: <SettingsView {...navProps} />,
    finances: <FinancesView />,
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Flame size={21} /></span><div><strong>{data.brandName}</strong><small>Home, held together</small></div></div>
      <nav aria-label="Primary navigation">
        {NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{id === 'plan' && data.inbox.some(i => i.status === 'unorganized') && <i>{data.inbox.filter(i => i.status === 'unorganized').length}</i>}</button>)}
      </nav>
      <div className="sidebar-footer">
        <button className={`account-control ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')} aria-label="Open household settings"><UserRound size={18} /><span><strong>{cloud?.user?.display_name || data.adults[0]}</strong><small>Account & settings</small></span><Settings size={16} /></button>
        <p><Users size={16} /> {data.adults.join(' + ')}</p>
        {cloud ? <div className={`sync-pill ${cloud.status}`} role="status" aria-live="polite"><span /> <small>{cloud.status === 'saving' ? 'Saving' : cloud.status === 'saved' ? 'Saved' : cloud.status === 'offline' ? 'Offline—changes waiting' : 'Needs attention'}</small>{['offline', 'attention'].includes(cloud.status) && <button onClick={cloud.retry}>{cloud.status === 'attention' ? 'Keep my changes' : 'Retry'}</button>}</div> : <small>Saved on this device</small>}
      </div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <main className="main-shell">
      <header className="mobile-header"><IconButton label="Open menu" onClick={() => setMobileNav(true)}><Menu /></IconButton><strong>{data.brandName}</strong><span /></header>
      {cloud?.status === 'attention' && <div className="sync-alert" role="alert"><div><strong>A newer household change was saved first.</strong><span>Your change is paused so nothing is overwritten silently. Review this screen, then keep your change only if it should replace the newer version.</span></div><Button variant="light" onClick={cloud.retry}>Keep my changes</Button></div>}
      {views[view]}
    </main>
    {modal?.type === 'task' && <TaskModal task={modal.task} adults={data.adults} onClose={() => setModal(null)} onSave={(form) => { saveTask(form, modal.task?.id && !modal.isNew ? modal.task : null); setModal(null); notify(modal.task?.id && !modal.isNew ? 'Task updated' : 'Task added') }} />}
    {modal?.type === 'defer' && <DeferModal task={modal.task} onClose={() => setModal(null)} onConfirm={(reason, timing) => { deferTask(modal.task, reason, timing); setModal(null); notify('Rescheduled with your approval') }} />}
    {modal?.type === 'event' && <EventModal event={modal.event} adults={data.adults} onClose={() => setModal(null)} onSave={(event) => { update(next => { next.events = modal.event ? next.events.map(e => e.id === modal.event.id ? event : e) : [...next.events, event] }); setModal(null); notify('Calendar updated') }} />}
    {modal?.type === 'goal' && <GoalModal goal={modal.goal} onClose={() => setModal(null)} onSave={(goal) => { update(next => { next.goals = modal.goal ? next.goals.map(g => g.id === modal.goal.id ? goal : g) : [...next.goals, goal] }); setModal(null); notify('Goal saved') }} />}
    {displayMode && <DisplayMode mode={displayMode} data={data} update={update} onClose={() => setDisplayMode(null)} navigate={(target) => { setDisplayMode(null); navigate(target) }} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>
}

function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>
}

function PlanView({ data, update, setModal, completeTask, navigate }) {
  const [section, setSection] = useState('today')
  const entries = buildPlanEntries(data)
  const sections = [['today', 'Today'], ['week', 'This week'], ['later', 'Later'], ['completed', 'Completed']]
  const recurrenceLabel = { daily: 'Daily', weekdays: 'Selected weekdays', weekly: 'Weekly', monthly: 'Monthly', 'after-completion': 'After completion' }
  const saveCapacity = (person, level) => update(next => {
    if (!next.capacity[person]) next.capacity[person] = { level: 'moderate', unavailable: '', note: '' }
    next.capacity[person].level = level
  })
  return <div className="page plan-page">
    <PageHeader eyebrow="Household plan" title="One plan for what’s ahead" description="Tasks, next actions, and upcoming commitments appear once, in the time window where they matter." actions={<><Button variant="outline" icon={CalendarDays} onClick={() => setModal({ type: 'event' })}>Add event</Button><Button icon={Plus} onClick={() => setModal({ type: 'task' })}>Add task</Button></>} />
    <section className="plan-capacity" aria-label="Weekend capacity">
      <div><span className="eyebrow">Weekend capacity</span><strong>Keep the plan realistic</strong></div>
      <div className="plan-capacity-people">{data.adults.map(person => <div className="plan-capacity-person" key={person}><span>{person}</span><div className="segmented" aria-label={`${person} weekend capacity`}>{['low', 'moderate', 'high'].map(level => <button type="button" key={level} className={data.capacity?.[person]?.level === level ? 'selected' : ''} onClick={() => saveCapacity(person, level)}>{titleCase(level)}</button>)}</div></div>)}</div>
    </section>
    <div className="plan-tabs" role="tablist" aria-label="Plan timing">{sections.map(([id, label]) => <button role="tab" aria-selected={section === id} className={section === id ? 'active' : ''} key={id} onClick={() => setSection(id)}>{label}<span>{entries[id].length}</span></button>)}</div>
    <section className="plan-list" aria-live="polite">
      {entries[section].map(entry => <article className={`plan-row ${entry.type} ${section === 'completed' ? 'completed' : ''}`} key={entry.id}>
        {entry.type === 'task' ? <button className={`check-control ${entry.task.status === 'complete' ? 'done' : ''}`} disabled={entry.task.status === 'complete'} onClick={() => completeTask(entry.task.id)} aria-label={entry.task.status === 'complete' ? `Completed ${entry.title}` : `Complete ${entry.title}`}><Check size={15} /></button> : <span className="entry-icon">{entry.type === 'event' ? <CalendarDays size={17} /> : <Goal size={17} />}</span>}
        <div className="entry-copy"><strong>{entry.title}</strong>{entry.detail && <p>{entry.detail}</p>}<div className="entry-meta">{entry.type === 'task' && <><span>{entry.task.date || entry.task.dueWindow}</span>{entry.task.claimedBy && <span>{entry.task.claimedBy}</span>}{entry.task.recurrence && <span>{recurrenceLabel[entry.task.recurrence.type]}</span>}</>}{entry.type === 'event' && <span>Upcoming commitment</span>}{entry.type === 'goal' && <span>Goal next action</span>}</div></div>
        {entry.type === 'task' && <IconButton label={`Edit ${entry.title}`} onClick={() => setModal({ type: 'task', task: entry.task })}><Edit3 size={18} /></IconButton>}
        {entry.type === 'event' && <IconButton label={`Edit ${entry.title}`} onClick={() => setModal({ type: 'event', event: entry.event })}><Edit3 size={18} /></IconButton>}
        {entry.type === 'goal' && <IconButton label={`Edit ${entry.goal.title}`} onClick={() => setModal({ type: 'goal', goal: entry.goal })}><Edit3 size={18} /></IconButton>}
      </article>)}
      {!entries[section].length && <EmptyState icon={section === 'completed' ? CheckCircle2 : ClipboardList} title={section === 'completed' ? 'Nothing completed yet' : 'This part of the plan is clear'} text="Add something only when it would genuinely help the household coordinate." />}
    </section>
    {data.inbox.some(item => item.status === 'unorganized') && <button className="plan-inbox-link" onClick={() => navigate('inbox')}><Inbox size={17} /><span><strong>{data.inbox.filter(item => item.status === 'unorganized').length} captured thoughts</strong><small>Review them when you are ready.</small></span><ArrowRight size={17} /></button>}
  </div>
}

function TodayView({ data, update, setModal, completeTask, navigate }) {
  const priorityOrder = { must: 0, should: 1, could: 2 }
  const todayTaskIds = new Set(buildPlanEntries(data).today.filter(entry => entry.type === 'task').map(entry => entry.task.id))
  const importantTasks = [...data.tasks]
    .filter(task => task.status === 'open' && (todayTaskIds.has(task.id) || task.timeSensitive))
    .sort((a, b) => Number(Boolean(b.timeSensitive)) - Number(Boolean(a.timeSensitive)) || (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
    .slice(0, 3)
  const openRoutines = Object.entries(data.routines).filter(([, routine]) => routine.items.some(item => item.status !== 'given'))
  const todayKey = new Date().toISOString().slice(0, 10)
  const upcoming = [...data.events].filter(event => event.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0]
  return <div className="page today-page">
    <PageHeader eyebrow={friendlyDate()} title="What matters today" description="Care, a few important actions, and the next commitment—everything else can wait in Plan." actions={<Button variant="soft" icon={Plus} onClick={() => setModal({ type: 'task' })}>Add item</Button>} />
    <div className="today-grid">
      <section className="stack-card routines-panel"><div className="section-heading"><div><span className="eyebrow">Due care</span><h2>Pet routines</h2></div><PawPrint size={21} /></div>
        {openRoutines.length ? openRoutines.map(([period, routine]) => <RoutineCard key={period} period={period} routine={routine} update={update} />) : data.pets.length ? <EmptyState icon={ShieldCheck} title="Pet care is covered" text="Nothing else needs confirmation right now." /> : <EmptyState icon={PawPrint} title="No pet care added" text="This stays quiet until a real pet profile is added." />}
      </section>
      <section className="stack-card"><div className="section-heading"><div><span className="eyebrow">Up next</span><h2>Important actions</h2></div><Clock3 size={21} /></div>
        <div className="task-list compact">
          {importantTasks.map(task => <div className="today-task" key={task.id}><div><strong>{task.title}</strong><p>{task.explanation}</p><span>{task.dueWindow} · {task.minutes} min</span></div><div className="today-task-actions"><Button variant="soft" icon={Check} onClick={() => completeTask(task.id)}>Complete</Button><IconButton label={`Edit ${task.title}`} onClick={() => setModal({ type: 'task', task })}><MoreHorizontal size={19} /></IconButton></div></div>)}
          {!importantTasks.length && <EmptyState title="Today is clear" text="There are no important household actions waiting right now." />}
        </div>
        <Button variant="text" onClick={() => navigate('plan')}>Open Plan <ArrowRight size={16} /></Button>
      </section>
    </div>
    <section className="next-strip">
      <div className="next-icon"><CalendarDays /></div><div><span className="eyebrow">Next commitment</span><h3>{upcoming?.private ? 'Private appointment' : upcoming?.title || 'Nothing upcoming'}</h3><p>{upcoming ? `${shortDate(upcoming.date)} at ${displayClock(upcoming.time)}${upcoming.preparation ? ` · Prepare: ${upcoming.preparation}` : ''}` : 'The near future is open.'}</p></div><Button variant="outline" onClick={() => navigate('plan')}>Open Plan</Button>
    </section>
  </div>
}

function RoutineCard({ period, routine, update }) {
  const [expanded, setExpanded] = useState(false)
  const complete = routine.items.every(i => i.status === 'given')
  const updateItem = (id, status) => update(next => { next.routines = updateRoutineItem(next.routines, period, id, status) })
  const completeAll = () => update(next => { next.routines = confirmRoutine(next.routines, period) })
  return <div className={`routine-card ${complete ? 'complete' : ''}`}>
    <div className="routine-top"><button className="routine-title" onClick={() => setExpanded(v => !v)}><span className={`routine-symbol ${period}`} >{period === 'morning' ? <Sun size={19} /> : <Moon size={19} />}</span><div><strong>{titleCase(period)} routine</strong><span>{routine.time} · {complete ? 'Confirmed' : `${routine.items.filter(i => i.status === 'given').length} of ${routine.items.length} confirmed`}</span></div>{expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
      <Button variant={complete ? 'quiet' : 'soft'} icon={complete ? Check : undefined} onClick={completeAll}>{complete ? 'All given' : 'Confirm all'}</Button></div>
    {expanded && <div className="routine-items">{routine.items.map(item => <div key={item.id} className="routine-item"><div><strong>{item.pet}</strong><span>{item.action}</span></div><select aria-label={`Status for ${item.pet}`} value={item.status} onChange={e => updateItem(item.id, e.target.value)}><option value="open">Still open</option><option value="given">Given</option><option value="soon">I’ll do it soon</option><option value="ask">Ask the other person</option><option value="problem">Problem or skipped</option></select></div>)}<p className="human-note"><Info size={14} /> Medication is only marked given after a person confirms it.</p></div>}
  </div>
}

function WeekendView({ data, update, setModal, completeTask, claimTask, deleteTask, notify }) {
  const pool = data.tasks.filter(t => t.date === 'Weekend' && t.status !== 'deferred')
  const totals = Object.fromEntries(data.adults.map(a => [a, pool.filter(t => t.claimedBy === a && t.status !== 'complete').reduce((sum, t) => sum + t.effort, 0)]))
  const saveCapacity = (person, key, value) => update(next => { next.capacity[person][key] = value; next.capacity.generated = false })
  const generate = () => { update(next => { next.capacity.generated = true }); notify('A balanced pool is ready — nothing has been assigned') }
  return <div className="page">
    <PageHeader eyebrow="Capacity-aware planning" title="Shape the weekend together" description="Start with the energy you actually have. Hearthline suggests; you decide." actions={<Button icon={Plus} onClick={() => setModal({ type: 'task' })}>Add a task</Button>} />
    <section className="capacity-card">
      <div className="capacity-intro"><span className="capacity-icon"><Sparkles /></span><div><h2>How much room is there?</h2><p>Update each person’s capacity before refreshing the suggested pool.</p></div></div>
      <div className="capacity-people">{data.adults.map(person => <div className="capacity-person" key={person}><div className="person-heading"><span>{person.slice(0, 1)}</span><strong>{person}</strong></div><div className="segmented" aria-label={`${person} capacity`}>{['low', 'moderate', 'high'].map(level => <button key={level} className={data.capacity[person].level === level ? 'selected' : ''} onClick={() => saveCapacity(person, 'level', level)}>{titleCase(level)}</button>)}</div><label>Unavailable time<input value={data.capacity[person].unavailable} onChange={e => saveCapacity(person, 'unavailable', e.target.value)} placeholder="e.g. Saturday morning" /></label><label>Energy or circumstances <span>optional</span><input value={data.capacity[person].note} onChange={e => saveCapacity(person, 'note', e.target.value)} placeholder="Anything useful to know?" /></label></div>)}</div>
      <div className="capacity-footer"><div><strong>{data.adults.reduce((total, person) => total + capacityLimit[data.capacity[person]?.level || 'moderate'], 0)} effort points</strong><span>Suggested shared ceiling based on both responses</span></div><Button icon={Sparkles} onClick={generate}>{data.capacity.generated ? 'Refresh suggested pool' : 'Generate suggested pool'}</Button></div>
    </section>
    {data.capacity.generated ? <>
      <div className="balance-bar"><div><span className="eyebrow">Gently balanced</span><strong>{data.adults[0]}: {totals[data.adults[0]]} points · {data.adults[1]}: {totals[data.adults[1]]} points</strong></div><p>Claim what feels workable. Unclaimed tasks are shared possibilities, not anyone’s failure.</p></div>
      {['must', 'should', 'could'].map(priority => <TaskGroup key={priority} priority={priority} tasks={pool.filter(t => t.priority === priority)} adults={data.adults} onComplete={completeTask} onClaim={claimTask} onEdit={task => setModal({ type: 'task', task })} onDefer={task => setModal({ type: 'defer', task })} onDelete={deleteTask} />)}
    </> : <EmptyState icon={Sparkles} title="Your pool is waiting" text="Tell Hearthline about this weekend’s capacity, then generate a realistic set of options." action={<Button onClick={generate}>Generate the pool</Button>} />}
  </div>
}

const groupCopy = {
  must: ['Must do', 'Health, safety, deadlines, and necessary preparation', 'warm'],
  should: ['Should do', 'Timely care that prevents future friction', 'sage'],
  could: ['Could do', 'Improvements and goals, only if there is room', 'blue'],
}

function TaskGroup({ priority, tasks, adults, onComplete, onClaim, onEdit, onDefer, onDelete }) {
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState(null)
  const [claiming, setClaiming] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [label, description, tone] = groupCopy[priority]
  return <section className="task-group"><button className="group-header" onClick={() => setOpen(v => !v)}><span className={`group-dot ${tone}`} /><div><h2>{label}</h2><p>{description}</p></div><span className="group-count">{tasks.filter(t => t.status !== 'complete').length} open</span>{open ? <ChevronDown /> : <ChevronRight />}</button>
    {open && <div className="task-cards">{tasks.map(task => <article className={`task-card ${task.status === 'complete' ? 'completed' : ''}`} key={task.id}>
      <button className={`big-check ${task.status === 'complete' ? 'done' : ''}`} onClick={() => onComplete(task.id)} aria-label={`Complete ${task.title}`}><Check size={17} /></button>
      <div className="task-body"><div className="task-title-line"><h3>{task.title}</h3><div className="task-actions"><IconButton label="More options" onClick={() => setMenu(menu === task.id ? null : task.id)}><MoreHorizontal size={20} /></IconButton>{menu === task.id && <div className="context-menu"><button onClick={() => { onEdit(task); setMenu(null) }}><Edit3 />Edit</button><button onClick={() => { onDefer(task); setMenu(null) }}><Clock3 />Defer</button><button className="danger" onClick={() => { setConfirmDelete(task.id); setMenu(null) }}><Trash2 />Delete</button></div>}</div></div>
        <p>{task.explanation}</p><button className="details-toggle" onClick={() => setExpanded(expanded === task.id ? null : task.id)}>{expanded === task.id ? 'Hide details' : 'Why this fits'} {expanded === task.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
        {expanded === task.id && <div className="task-details"><span><strong>Due</strong>{task.dueWindow}</span><span><strong>Best time</strong>{task.timing}</span><span><strong>Approach</strong>{titleCase(task.help)}</span>{task.cost && <span><strong>Possible cost</strong>{task.cost}</span>}</div>}
        <div className="task-meta"><Chip>{task.category}</Chip><span><Clock3 /> {task.minutes} min</span><span><Flame /> {task.effort} effort</span><span>{task.setting === 'outdoor' ? <CloudSun /> : <Home />} {titleCase(task.setting)}</span></div>
      </div>
      <div className="claim-wrap"><button className={`claim-button ${task.claimedBy ? 'claimed' : ''}`} onClick={() => setClaiming(claiming === task.id ? null : task.id)}>{task.claimedBy ? <><UserRound size={16} />{task.claimedBy}</> : 'Claim'}<ChevronDown size={14} /></button>{claiming === task.id && <div className="claim-menu">{adults.map(person => <button key={person} onClick={() => { onClaim(task.id, person); setClaiming(null) }}>{task.claimedBy === person && <Check size={15} />}{person}</button>)}{task.claimedBy && <button onClick={() => { onClaim(task.id, task.claimedBy); setClaiming(null) }}><Minus size={15} />Unclaim</button>}</div>}</div>
      {confirmDelete === task.id && <div className="inline-confirm"><span>Delete this task?</span><button onClick={() => { onDelete(task.id); setConfirmDelete(null) }}>Delete</button><button onClick={() => setConfirmDelete(null)}>Keep</button></div>}
    </article>)}{tasks.length === 0 && <p className="group-empty">Nothing here right now.</p>}</div>}
  </section>
}

function TaskModal({ task, adults, onClose, onSave }) {
  const [recurrence, setRecurrence] = useState(task?.recurrence?.type || 'none')
  const timing = !task ? 'This week' : ['Today', 'This week', 'Later'].includes(task.date) ? task.date : task.date === 'Weekend' ? 'This week' : 'Later'
  return <Modal title={task ? 'Edit task' : 'Add a household task'} subtitle="A title is enough. Timing and owner can stay simple." onClose={onClose}>
    <form className="form-grid" onSubmit={e => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}>
      <label className="span-2">Title<input name="title" defaultValue={task?.title} required autoFocus /></label>
      <label>Timing<select name="timing" defaultValue={timing}><option>Today</option><option>This week</option><option>Later</option></select></label>
      <label>Optional owner<select name="owner" defaultValue={task?.claimedBy || ''}><option value="">Unassigned</option>{adults.map(adult => <option key={adult}>{adult}</option>)}</select></label>
      <details className="more-details span-2"><summary>More details</summary><div className="more-details-grid">
        <label className="span-2">Notes<textarea name="notes" defaultValue={task?.explanation} rows="3" placeholder="Anything useful to remember?" /></label>
        <label className="span-2">Repeat<select name="recurrence" value={recurrence} onChange={event => setRecurrence(event.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Selected weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="after-completion">After completion</option></select></label>
        {recurrence === 'weekdays' && <fieldset className="span-2 weekday-picker"><legend>Repeat on</legend>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label key={day}><input type="checkbox" name="weekdays" value={index} defaultChecked={task?.recurrence?.weekdays?.includes(index) ?? (index > 0 && index < 6)} />{day}</label>)}</fieldset>}
        {recurrence === 'after-completion' && <label className="span-2">Days after completion<input name="intervalDays" type="number" min="1" max="365" defaultValue={task?.recurrence?.intervalDays || 7} /></label>}
        {task && <p className="legacy-task-note span-2">Existing effort, priority, category, and home details are preserved when you save.</p>}
      </div></details>
      <div className="form-actions span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{task ? 'Save changes' : 'Add task'}</Button></div>
    </form>
  </Modal>
}

function DeferModal({ task, onClose, onConfirm }) {
  const [reason, setReason] = useState('Not enough time')
  const suggestionMap = { 'Not enough time': 'Next weekend', 'Not enough energy': 'A lower-capacity day next week', Weather: 'Next dry-weather window', 'Waiting on someone or something': 'Review in one week', 'Too expensive right now': 'Review next month', 'No longer relevant': 'Archive without rescheduling', 'Suggested timing was wrong': 'Choose a better date', Other: 'Review next week' }
  const [timing, setTiming] = useState(suggestionMap[reason])
  const choose = value => { setReason(value); setTiming(suggestionMap[value]) }
  return <Modal title="Reschedule with context" subtitle={`Why isn’t “${task.title}” a fit right now?`} onClose={onClose}>
    <div className="reason-list">{Object.keys(suggestionMap).map(item => <button key={item} className={reason === item ? 'selected' : ''} onClick={() => choose(item)}><span>{reason === item && <Check size={14} />}</span>{item}</button>)}</div>
    <div className="suggestion-box"><Sparkles size={18} /><div><strong>Suggested new timing</strong><input value={timing} onChange={e => setTiming(e.target.value)} /><p>Nothing changes until you approve this timing.</p></div></div>
    <div className="form-actions"><Button variant="outline" onClick={onClose}>Keep current timing</Button><Button onClick={() => onConfirm(reason, timing)}>Approve & reschedule</Button></div>
  </Modal>
}

function CalendarView({ data, update, setModal, notify }) {
  const [perspective, setPerspective] = useState(data.adults[0])
  const events = [...data.events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const conflicts = events.filter((event, index) => events.some((other, i) => i !== index && other.date === event.date && timeMinutes(other.time) < timeMinutes(event.end) && timeMinutes(other.end) > timeMinutes(event.time)))
  const deleteEvent = id => update(next => { next.events = next.events.filter(e => e.id !== id) })
  const shareEvent = id => { update(next => { const event = next.events.find(e => e.id === id); if (event) { event.source = 'Household'; event.private = false } }); notify('Converted to a shared household event') }
  if (!events.length) return <div className="page"><PageHeader eyebrow="Household calendar" title="See what the week holds" description="Add only the commitments that help the household coordinate." actions={<Button icon={Plus} onClick={() => setModal({ type: 'event' })}>Add event</Button>} /><EmptyState icon={CalendarDays} title="Nothing is scheduled here" text="Hearthline will show the next shared commitment on Today when you add one." action={<Button onClick={() => setModal({ type: 'event' })}>Add the first event</Button>} /></div>
  return <div className="page"><PageHeader eyebrow="Household calendar" title="See what the week holds" description="A shared planning layer for the household. External calendar connections are a future integration." actions={<Button icon={Plus} onClick={() => setModal({ type: 'event' })}>Add event</Button>} />
    <div className="integration-note"><Info size={18} /><div><strong>Manual calendar for now</strong><p>Events saved here stay in Hearthline. Google, Apple, and Outlook sync are not connected.</p></div><Chip tone="blue">Future integration</Chip></div>
    <div className="calendar-toolbar"><div className="segmented">{data.adults.map((adult, index) => <button key={adult} className={perspective === adult ? 'selected' : ''} onClick={() => setPerspective(adult)}>{index === 0 ? 'Your view' : `${adult}’s view`}</button>)}</div>{conflicts.length > 0 && <span className="conflict-chip"><Info size={15} /> {conflicts.length / 2} possible conflict</span>}</div>
    <div className="calendar-list">{events.map(event => { const hidden = event.private && event.source !== perspective; const conflict = conflicts.some(e => e.id === event.id); return <article className="event-card" key={event.id}><div className="date-tile"><strong>{shortDate(event.date).split(' ')[1]}</strong><span>{shortDate(event.date).split(' ')[0]}</span></div><div className="event-main"><div className="event-title"><h3>{hidden ? 'Unavailable' : event.title}</h3><Chip tone={event.source === 'Household' ? 'sage' : 'neutral'}>{event.source}</Chip>{event.private && <Chip>Private</Chip>}{conflict && <Chip tone="warm">Conflict</Chip>}</div><p>{event.time}–{event.end}{!hidden && event.location ? ` · ${event.location}` : ''}</p>{!hidden && event.preparation && <div className="prep-line"><ClipboardList size={16} /><span><strong>Prepare:</strong> {event.preparation}</span></div>}{!hidden && event.source !== 'Household' && <button className="share-suggestion" onClick={() => shareEvent(event.id)}><Sparkles size={14} /> Make this a shared household event</button>}</div>{!hidden && <div className="row-actions"><IconButton label="Edit event" onClick={() => setModal({ type: 'event', event })}><Edit3 size={18} /></IconButton><IconButton label="Delete event" onClick={() => deleteEvent(event.id)}><Trash2 size={18} /></IconButton></div>}</article>})}</div>
  </div>
}

function EventModal({ event, adults, onClose, onSave }) {
  const submit = e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: event?.id || uid('event'), title: f.get('title'), date: f.get('date'), time: f.get('time'), end: f.get('end'), source: f.get('source'), private: f.get('private') === 'on', location: f.get('location'), preparation: f.get('preparation') }) }
  return <Modal title={event ? 'Edit event' : 'Add an event'} onClose={onClose}><form className="form-grid" onSubmit={submit}><label className="span-2">Title<input name="title" defaultValue={event?.title} required autoFocus /></label><label>Date<input type="date" name="date" defaultValue={event?.date} required /></label><label>Calendar source<select name="source" defaultValue={event?.source || 'Household'}>{adults.map(adult => <option key={adult}>{adult}</option>)}<option>Household</option></select></label><label>Starts<input type="time" name="time" defaultValue={event?.time} required /></label><label>Ends<input type="time" name="end" defaultValue={event?.end} required /></label><label className="span-2">Location<input name="location" defaultValue={event?.location} /></label><label className="span-2">Preparation task<textarea name="preparation" rows="2" defaultValue={event?.preparation} placeholder="What should be ready beforehand?" /></label><label className="checkbox-label span-2"><input name="private" type="checkbox" defaultChecked={event?.private} /> Private — show only “Unavailable” to the other person</label><div className="form-actions span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save event</Button></div></form></Modal>
}

function HomeView({ data, update, setModal, notify }) {
  const [tab, setTab] = useState('health')
  const visibleRecs = data.recommendations.filter(r => r.status === 'suggested')
  const [expandedRec, setExpandedRec] = useState(visibleRecs[0]?.id)
  const [profileEdit, setProfileEdit] = useState(false)
  const [historyForm, setHistoryForm] = useState(false)
  const acceptRec = rec => {
    update(next => {
      const target = next.recommendations.find(r => r.id === rec.id); if (target) target.status = 'accepted'
      next.tasks.push({ id: uid('task'), title: rec.title, explanation: rec.why, category: 'Home', minutes: rec.effort * 15, effort: rec.effort, dueWindow: rec.timing, timing: rec.timing, setting: 'indoor', help: rec.pro.toLowerCase().includes('professional') ? 'either' : 'diy', cost: '', priority: rec.confidence.startsWith('High') ? 'should' : 'could', claimedBy: '', status: 'open', date: 'Weekend' })
      const queued = next.recommendations.find(r => r.status === 'queued'); if (queued) queued.status = 'suggested'
    }); notify('Added to the weekend pool')
  }
  const updateRec = (id, status) => { update(next => { const rec = next.recommendations.find(r => r.id === id); if (rec) rec.status = status; const queued = next.recommendations.find(r => r.status === 'queued'); if (queued) queued.status = 'suggested' }); notify(status === 'not-applicable' ? 'Marked not applicable' : status === 'dismissed' ? 'Suggestion dismissed' : 'We’ll bring this back later') }
  if (tab === 'health' && !visibleRecs.length) return <div className="page"><PageHeader eyebrow="Home" title="Keep only useful home facts" description="Start with information you would otherwise have to search for. Hearthline will not invent recommendations." actions={<Button icon={Plus} onClick={() => setModal({ type: 'task' })}>Add home task</Button>} /><div className="tab-bar"><button className="active">Health suggestions</button><button onClick={() => setTab('profile')}>Home profile</button><button onClick={() => setTab('history')}>History & records</button></div><EmptyState icon={Home} title="No home suggestions" text="Add a few property facts when they become useful, or keep this area empty." action={<Button variant="outline" onClick={() => setTab('profile')}>Add home facts</Button>} /></div>
  return <div className="page"><PageHeader eyebrow="Home health" title="Know your home a little better" description="Small, explainable recommendations based on what Hearthline knows — never a surprise backlog." actions={<Button icon={Plus} onClick={() => setModal({ type: 'task' })}>Add home task</Button>} />
    <div className="tab-bar"><button className={tab === 'health' ? 'active' : ''} onClick={() => setTab('health')}>Health suggestions</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Home profile</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History & records</button></div>
    {tab === 'health' && <div className="home-layout"><section><div className="gentle-intro"><Leaf size={20} /><div><strong>A few timely ideas</strong><p>Hearthline introduces only a small set at once. You can accept, adjust, defer, dismiss, or say something does not apply.</p></div></div><div className="recommendation-list">{visibleRecs.map(rec => <article className="recommendation-card" key={rec.id}><button className="rec-summary" onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}><span className="rec-symbol"><Wrench size={18} /></span><div><h3>{rec.title}</h3><p>{rec.timing} · Effort {rec.effort}</p></div><Chip tone={rec.confidence.startsWith('High') ? 'sage' : 'neutral'}>{rec.confidence.split(' — ')[0]} confidence</Chip>{expandedRec === rec.id ? <ChevronDown /> : <ChevronRight />}</button>{expandedRec === rec.id && <div className="rec-detail"><div className="reason-grid"><div><span>Why it may matter</span><p>{rec.why}</p></div><div><span>Why this was suggested</span><p>{rec.suggestedBecause}</p></div><div><span>Timing & effort</span><p>{rec.timing} · Effort {rec.effort} of 8</p></div><div><span>Professional help</span><p>{rec.pro}</p></div></div>{rec.confidence.includes('unknown') && <button className="dont-know" onClick={() => acceptRec({ ...rec, title: `Research: ${rec.title.toLowerCase()}` })}>I don’t know the history — make this a research task</button>}<div className="rec-actions"><Button variant="soft" onClick={() => acceptRec(rec)}>Accept</Button><Button variant="outline" onClick={() => setModal({ type: 'task', task: { title: rec.title, explanation: rec.why, category: 'Home', minutes: rec.effort * 15, effort: rec.effort, dueWindow: rec.timing, timing: rec.timing, setting: 'indoor', help: 'either', cost: '', priority: 'should', date: 'Weekend' } })}>Edit first</Button><Button variant="text" onClick={() => updateRec(rec.id, 'deferred')}>Defer</Button><Button variant="text" onClick={() => updateRec(rec.id, 'dismissed')}>Dismiss</Button><Button variant="text" onClick={() => updateRec(rec.id, 'not-applicable')}>Not applicable</Button></div></div>}</article>)}</div></section><aside className="home-sidebar"><div className="home-score"><span className="home-illustration"><Home size={34} /></span><span className="eyebrow">Household knowledge</span><h3>A solid start</h3><p>Hearthline knows the main systems and property type. Service history will improve timing.</p><div className="progress-track"><span style={{ width: '68%' }} /></div><button onClick={() => setTab('profile')}>Review home profile <ArrowRight size={15} /></button></div><div className="season-card"><span>Right now</span><strong>Late autumn in Zone 6</strong><p>Prioritize freeze readiness, gutters, chimney care, and a safe storm walk.</p></div></aside></div>}
    {tab === 'profile' && <HomeProfile profile={data.homeProfile} editing={profileEdit} onEdit={() => setProfileEdit(true)} onCancel={() => setProfileEdit(false)} onSave={form => { update(next => { const p = next.homeProfile; ['ownership','state','year','zone','hvac','heat','acreage','notes'].forEach(k => p[k] = form.get(k)); ['basement','sumpPump','septic','garage','lawn','gutters'].forEach(k => p[k] = form.get(k) === 'on') }); setProfileEdit(false); notify('Home profile updated') }} />}
    {tab === 'history' && <HistoryView history={data.history} showForm={historyForm} setShowForm={setHistoryForm} update={update} notify={notify} />}
  </div>
}

function HomeProfile({ profile, editing, onEdit, onCancel, onSave }) {
  const systems = [['Basement', 'basement'], ['Sump pump', 'sumpPump'], ['Septic system', 'septic'], ['Garage', 'garage'], ['Lawn', 'lawn'], ['Gutters', 'gutters']]
  const hasFacts = Object.values(profile).some(Boolean)
  if (editing) return <form className="profile-form card" onSubmit={e => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}><div className="section-heading"><div><span className="eyebrow">Editable profile</span><h2>About the house</h2></div></div><div className="form-grid"><label>Ownership<input name="ownership" defaultValue={profile.ownership} /></label><label>State or region<input name="state" defaultValue={profile.state} /><small>No street address needed.</small></label><label>Year built<input name="year" defaultValue={profile.year} /></label><label>Growing zone<input name="zone" defaultValue={profile.zone} /></label><label>Heating & cooling<input name="hvac" defaultValue={profile.hvac} /></label><label>Additional heat<input name="heat" defaultValue={profile.heat} /></label><label className="span-2">Property<input name="acreage" defaultValue={profile.acreage} /></label><fieldset className="span-2"><legend>Systems and spaces</legend><div className="system-checks">{systems.map(([label, key]) => <label className="checkbox-label" key={key}><input type="checkbox" name={key} defaultChecked={profile[key]} />{label}</label>)}</div></fieldset><label className="span-2">Notes<textarea rows="3" name="notes" defaultValue={profile.notes} placeholder="Anything else worth remembering?" /></label><div className="form-actions span-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Save profile</Button></div></div></form>
  if (!hasFacts) return <div className="profile-card card"><EmptyState icon={Home} title="No home facts yet" text="Add only details that prevent repeated searching or support a real reminder." action={<Button variant="outline" icon={Edit3} onClick={onEdit}>Add useful facts</Button>} /></div>
  return <div className="profile-card card"><div className="section-heading"><div><span className="eyebrow">Home profile</span><h2>{[profile.year, profile.ownership].filter(Boolean).join(' ') || 'Household facts'}</h2><p>{[profile.state, profile.zone].filter(Boolean).join(' · ')}</p></div><Button variant="outline" icon={Edit3} onClick={onEdit}>Edit profile</Button></div><div className="profile-facts"><div><span>Climate & land</span><strong>{profile.acreage || 'Not recorded'}</strong><p>{profile.zone}</p></div><div><span>Core systems</span><strong>{profile.hvac || 'Not recorded'}</strong><p>{profile.heat}</p></div><div><span>Foundation & water</span><strong>{profile.basement ? 'Basement' : 'No basement recorded'}</strong><p>{profile.sumpPump ? 'Sump pump' : 'No sump pump recorded'} · {profile.septic ? 'Septic' : 'Sewer not recorded'}</p></div></div><div className="system-pills">{[['Garage',profile.garage],['Lawn',profile.lawn],['Gutters',profile.gutters],['Septic',profile.septic],['Sump pump',profile.sumpPump]].filter(([,v]) => v).map(([label]) => <Chip tone="sage" key={label}><Check size={13} /> {label}</Chip>)}</div><div className="privacy-note"><ShieldCheck size={18} /><p><strong>Privacy by design.</strong> Hearthline does not need a precise street address for these recommendations.</p></div></div>
}

function HistoryView({ history, showForm, setShowForm, update, notify }) {
  const save = e => { e.preventDefault(); const form = new FormData(e.currentTarget); update(next => next.history.unshift({ id: uid('history'), title: form.get('title'), date: form.get('date'), provider: form.get('provider'), notes: form.get('notes'), next: form.get('next') })); setShowForm(false); notify('Home record saved') }
  if (!history.length && !showForm) return <div className="history-wrap"><div className="section-heading"><div><span className="eyebrow">Home memory</span><h2>Service & records</h2><p>Add a record when real household work happens.</p></div><Button icon={Plus} onClick={() => setShowForm(true)}>Add record</Button></div><EmptyState icon={Archive} title="No service records yet" text="Dates, providers, and next actions will appear here after you add them." /></div>
  return <div className="history-wrap"><div className="section-heading"><div><span className="eyebrow">Home memory</span><h2>Service & records</h2><p>Keep dates, providers, notes, and next actions together.</p></div><Button icon={Plus} onClick={() => setShowForm(true)}>Add record</Button></div>{showForm && <form className="history-form card" onSubmit={save}><div className="form-grid"><label>Service or record<input name="title" required autoFocus /></label><label>Date<input type="date" name="date" required /></label><label>Provider<input name="provider" placeholder="Optional" /></label><label>Next expected action<input name="next" placeholder="e.g. Service next fall" /></label><label className="span-2">Notes<textarea name="notes" rows="3" /></label><div className="record-storage-note span-2"><ShieldCheck size={17} /><span>Hearthline stores text records only. Keep receipts, photos, and manuals in your usual file storage.</span></div><div className="form-actions span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">Save record</Button></div></div></form>}<div className="history-timeline">{history.map(item => <article key={item.id}><div className="timeline-dot" /><div className="history-date">{shortDate(item.date)}</div><div className="history-card"><div><h3>{item.title}</h3><p>{item.provider || 'No provider recorded'}</p></div><p>{item.notes}</p>{item.files?.length > 0 && <div className="legacy-attachment-note"><Archive size={16} /><span>An earlier version referenced attachments here, but those files were never uploaded or stored.</span></div>}<div className="next-action"><ArrowRight size={16} /><span><strong>Next:</strong> {item.next || 'No next action set'}</span></div></div><IconButton label="Delete record" onClick={() => update(next => { next.history = next.history.filter(h => h.id !== item.id) })}><Trash2 size={17} /></IconButton></article>)}</div></div>
}

function PetCreateForm({ onCancel, onSave }) {
  return <form className="pet-create card" onSubmit={event => { event.preventDefault(); onSave(new FormData(event.currentTarget)) }}><div className="section-heading"><div><span className="eyebrow">New pet</span><h2>Add essential details</h2></div></div><div className="form-grid"><label>Name<input name="name" required autoFocus /></label><label>Species<input name="species" placeholder="Cat, dog, or other" /></label><div className="form-actions span-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Add pet</Button></div></div></form>
}

function PetsView({ data, update, notify }) {
  const [selected, setSelected] = useState(data.pets[0]?.id || '')
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const pet = data.pets.find(p => p.id === selected) || data.pets[0]
  const addPet = form => {
    const id = uid('pet'); const name = String(form.get('name')).trim(); const species = String(form.get('species')).trim() || 'Pet'
    update(next => {
      const colors = ['sage', 'clay', 'gold', 'blue']; const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'P'
      next.pets.push({ id, name, species, initials, color: colors[next.pets.length % colors.length], medication: 'No current medication', vet: '', vetPhone: '', notes: '', appointment: 'No appointment scheduled', supplies: 'No supply reminder' })
      next.routines.morning.items.push({ id: `care-morning-${id}`, pet: name, action: 'Breakfast & fresh water', status: 'open' })
      next.routines.evening.items.push({ id: `care-evening-${id}`, pet: name, action: 'Dinner & fresh water', status: 'open' })
    })
    setSelected(id); setAdding(false); notify('Pet added')
  }
  if (!pet) return <div className="page"><PageHeader eyebrow="Pet care" title="Everyone’s care, close at hand" description="Add only the pets and care details that belong to this household." actions={<Button icon={Plus} onClick={() => setAdding(true)}>Add pet</Button>} />{adding ? <PetCreateForm onCancel={() => setAdding(false)} onSave={addPet} /> : <EmptyState icon={PawPrint} title="No pets added" text="This area stays empty until you add a real pet profile." action={<Button onClick={() => setAdding(true)}>Add the first pet</Button>} />}</div>
  const save = e => { e.preventDefault(); const f = new FormData(e.currentTarget); update(next => { const p = next.pets.find(x => x.id === pet.id); ['name','species','medication','vet','vetPhone','notes','appointment','supplies'].forEach(k => p[k] = f.get(k)) }); setEditing(false); notify('Pet profile updated') }
  return <div className="page"><PageHeader eyebrow="Pet care" title="Everyone’s care, close at hand" description="Medication, appointments, supplies, and useful notes — with human confirmation where it matters." actions={<Button variant="outline" icon={Plus} onClick={() => setAdding(true)}>Add pet</Button>} />
    {adding && <PetCreateForm onCancel={() => setAdding(false)} onSave={addPet} />}
    <div className="pet-tabs">{data.pets.map(p => <button key={p.id} className={selected === p.id ? 'active' : ''} onClick={() => { setSelected(p.id); setEditing(false) }}><span className={`pet-avatar ${p.color}`}>{p.initials}</span><div><strong>{p.name}</strong><small>{p.species}</small></div></button>)}</div>
    <div className="pet-profile"><aside className={`pet-portrait ${pet.color}`}><div className="pet-silhouette">{pet.species === 'Dog' ? <Dog size={88} strokeWidth={1.2} /> : <PawPrint size={76} strokeWidth={1.2} />}</div><div><h2>{pet.name}</h2><p>{pet.species}</p></div><Button variant="light" icon={Edit3} onClick={() => setEditing(true)}>Edit profile</Button></aside>
      {editing ? <form className="pet-content" onSubmit={save}><div className="form-grid"><label>Name<input name="name" defaultValue={pet.name} required /></label><label>Species<input name="species" defaultValue={pet.species} /></label><label className="span-2">Medication schedule<input name="medication" defaultValue={pet.medication} /></label><label>Veterinarian<input name="vet" defaultValue={pet.vet} /></label><label>Vet phone<input name="vetPhone" defaultValue={pet.vetPhone} /></label><label className="span-2">Care notes<textarea name="notes" defaultValue={pet.notes} rows="3" /></label><label>Upcoming appointments<input name="appointment" defaultValue={pet.appointment} /></label><label>Supply reminders<input name="supplies" defaultValue={pet.supplies} /></label><div className="form-actions span-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit">Save profile</Button></div></div></form> : <div className="pet-content"><section className="pet-highlight"><span className="pet-highlight-icon"><HeartPulse /></span><div><span className="eyebrow">Medication</span><h3>{pet.medication}</h3><p>{pet.medication.includes('No current') ? 'No medication confirmation needed.' : 'Morning and evening doses appear in Today.'}</p></div></section><div className="pet-info-grid"><section><span className="mini-icon"><ClipboardList /></span><div><span>Care notes</span><p>{pet.notes}</p></div></section><section><span className="mini-icon"><CalendarDays /></span><div><span>Upcoming appointment</span><p>{pet.appointment}</p></div></section><section><span className="mini-icon"><Archive /></span><div><span>Supply reminder</span><p>{pet.supplies}</p></div></section><section><span className="mini-icon"><HeartPulse /></span><div><span>Veterinarian</span><p>{pet.vet}<br />{pet.vetPhone}</p></div></section></div></div>}
    </div>
  </div>
}

function GoalsView({ data, update, setModal, notify, navigate }) {
  const addToWeekend = goal => { update(next => next.tasks.push({ id: uid('task'), title: goal.next, explanation: `A next step for “${goal.title}”.`, category: 'Goals', minutes: 35, effort: 2, dueWindow: 'When capacity allows', timing: 'A quiet weekend block', setting: 'indoor', help: 'diy', cost: '', priority: 'could', claimedBy: '', status: 'open', date: 'Weekend', goalId: goal.id })); notify('Added as a Could do option') }
  if (!data.goals.length) return <div className="page"><PageHeader eyebrow="Projects & life goals" title="Make room for what you’re building" description="Longer-term ideas stay empty until you choose one worth keeping." actions={<Button icon={Plus} onClick={() => setModal({ type: 'goal' })}>Add goal</Button>} /><EmptyState icon={FolderHeart} title="No goals yet" text="Add one only when it has a useful next action." action={<Button onClick={() => setModal({ type: 'goal' })}>Add the first goal</Button>} /></div>
  return <div className="page"><PageHeader eyebrow="Projects & life goals" title="Make room for what you’re building" description="Goals live apart from urgent chores. Their next steps enter the weekend only when capacity allows." actions={<Button icon={Plus} onClick={() => setModal({ type: 'goal' })}>Add goal</Button>} />
    <div className="goal-intro"><FolderHeart size={25} /><div><strong>Protected from the urgent list</strong><p>Nothing here becomes a weekend task until one of you chooses it.</p></div></div><div className="goals-grid">{data.goals.map(goal => <article className="goal-card" key={goal.id}><div className="goal-top"><span className="goal-symbol"><Leaf /></span><div className="row-actions"><IconButton label="Edit goal" onClick={() => setModal({ type: 'goal', goal })}><Edit3 size={17} /></IconButton><IconButton label="Delete goal" onClick={() => update(next => { next.goals = next.goals.filter(g => g.id !== goal.id) })}><Trash2 size={17} /></IconButton></div></div><h2>{goal.title}</h2><p>{goal.description}</p><div className="goal-progress"><div><span>Progress</span><strong>{goal.progress}%</strong></div><div className="progress-track"><span style={{ width: `${goal.progress}%` }} /></div></div><div className="next-step"><span>Suggested next action</span><strong>{goal.next}</strong></div><Button variant="outline" onClick={() => addToWeekend(goal)}>Offer to the weekend pool</Button></article>)}</div><Button variant="text" onClick={() => navigate('weekend')}>See capacity-aware weekend planning <ArrowRight size={16} /></Button>
  </div>
}

function GoalModal({ goal, onClose, onSave }) {
  const submit = e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: goal?.id || uid('goal'), title: f.get('title'), description: f.get('description'), progress: Number(f.get('progress')), next: f.get('next'), status: 'active' }) }
  return <Modal title={goal ? 'Edit goal' : 'Add a shared goal'} onClose={onClose}><form className="form-grid" onSubmit={submit}><label className="span-2">Goal name<input name="title" defaultValue={goal?.title} required autoFocus /></label><label className="span-2">What are you hoping to change?<textarea name="description" defaultValue={goal?.description} rows="3" required /></label><label>Progress<input type="number" name="progress" min="0" max="100" defaultValue={goal?.progress || 0} /></label><label>Suggested next action<input name="next" defaultValue={goal?.next} required /></label><div className="form-actions span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save goal</Button></div></form></Modal>
}

function InboxView({ data, update, notify, navigate }) {
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [speechMessage, setSpeechMessage] = useState('')
  const [review, setReview] = useState(null)
  const recognitionRef = useRef(null)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const classify = text => {
    const lower = text.toLowerCase()
    const pet = ['cat','dog','pet','medication','vet'].some(w => lower.includes(w))
    const event = ['appointment','meeting','visit'].some(w => lower.includes(w))
    const goal = ['we should','improve','project','organize'].some(w => lower.includes(w))
    return { type: event ? 'Calendar event' : pet ? 'Pet task' : goal ? 'Possible goal' : 'Home task', category: pet ? 'Pets' : event ? 'Calendar' : goal ? 'Goals' : 'Home', timing: lower.includes('next month') ? 'Next month' : lower.includes('today') ? 'Today' : 'This weekend', effort: lower.includes('inspect') || lower.includes('strange') ? 2 : 1, destination: event ? 'Calendar' : pet ? 'Pets' : goal ? 'Goals' : 'Home' }
  }
  const startSpeech = () => {
    if (!SpeechRecognition) { setSpeechMessage('Speech recognition is not available in this browser. Typed capture still works.'); return }
    try {
      const recognition = new SpeechRecognition(); recognition.continuous = false; recognition.interimResults = true; recognition.lang = 'en-US'; recognitionRef.current = recognition
      recognition.onstart = () => { setListening(true); setSpeechMessage('Listening…') }
      recognition.onresult = event => { const transcript = [...event.results].map(r => r[0].transcript).join(''); setDraft(transcript); setSpeechMessage(event.results[event.results.length - 1].isFinal ? 'Transcript ready — edit anything before saving.' : 'Listening…') }
      recognition.onerror = () => { setListening(false); setSpeechMessage('Microphone access was unavailable. You can keep typing instead.') }
      recognition.onend = () => setListening(false)
      recognition.start()
    } catch { setSpeechMessage('Speech recognition could not start. You can keep typing instead.') }
  }
  const stage = () => { if (!draft.trim()) return; setReview({ id: uid('inbox'), text: draft.trim(), created: 'Just now', suggestion: classify(draft), status: 'unorganized' }) }
  const saveInbox = () => { update(next => next.inbox.unshift(review)); setDraft(''); setReview(null); notify('Saved to the household inbox') }
  const confirmOrganize = item => {
    update(next => {
      const found = next.inbox.find(i => i.id === item.id)
      if (found) found.status = 'organized'
      const destination = item.suggestion.destination
      if (destination === 'Calendar') {
        const date = new Date()
        if (item.suggestion.timing.toLowerCase().includes('next month')) date.setMonth(date.getMonth() + 1)
        next.events.push({ id: uid('event'), title: item.text, date: date.toISOString().slice(0, 10), time: '09:00', end: '10:00', source: 'Household', private: false, location: '', preparation: '' })
      } else if (destination === 'Goals') {
        next.goals.push({ id: uid('goal'), title: item.text, description: 'Captured from the household inbox.', progress: 0, next: 'Choose a small first step', status: 'active' })
      } else {
        next.tasks.push({ id: uid('task'), title: item.text, explanation: 'Captured from the household inbox.', category: item.suggestion.category, minutes: item.suggestion.effort * 15, effort: item.suggestion.effort, dueWindow: item.suggestion.timing, timing: 'Flexible', setting: 'indoor', help: 'diy', cost: '', priority: 'should', claimedBy: '', status: 'open', date: destination === 'Today' || item.suggestion.timing === 'Today' ? 'Today' : 'Weekend' })
      }
    })
    notify(`Organized into ${item.suggestion.destination}`)
  }
  return <div className="page"><PageHeader eyebrow="Quick capture" title="Get it out of your head" description="Capture the rough thought now. Hearthline will suggest where it might belong, and wait for your confirmation." />
    <section className="capture-card"><div className="capture-input"><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Try “Pick up a refill” or “The garage door sounds strange.”" rows="4" /><button className={`mic-button ${listening ? 'listening' : ''}`} onClick={listening ? () => recognitionRef.current?.stop() : startSpeech} aria-label={listening ? 'Stop listening' : 'Start voice capture'}>{listening ? <MicOff /> : <Mic />}</button></div>{speechMessage && <p className="speech-status">{listening && <span />} {speechMessage}</p>}<div className="capture-footer"><small>{SpeechRecognition ? 'Voice capture is supported in this browser.' : 'Voice capture is unavailable here; typing works normally.'}</small><Button onClick={stage} disabled={!draft.trim()}>Review capture</Button></div></section>
    {review && <section className="review-capture"><div className="section-heading"><div><span className="eyebrow">Review before saving</span><h2>Does this look right?</h2></div><IconButton label="Close review" onClick={() => setReview(null)}><X size={20} /></IconButton></div><textarea value={review.text} onChange={e => { const text = e.target.value; setReview({ ...review, text, suggestion: classify(text) }) }} rows="2" /><SuggestionEditor item={review} onChange={suggestion => setReview({ ...review, suggestion })} /><div className="form-actions"><Button variant="outline" onClick={() => setReview(null)}>Keep editing</Button><Button onClick={saveInbox}>Confirm & save to inbox</Button></div></section>}
    <section className="inbox-section"><div className="section-heading"><div><span className="eyebrow">Unsorted thoughts</span><h2>Household inbox</h2></div></div><div className="inbox-list">{data.inbox.map(item => <article className={item.status === 'organized' ? 'organized' : ''} key={item.id}><span className="inbox-status">{item.status === 'organized' ? <Check /> : <Inbox />}</span><div><h3>{item.text}</h3><p>{item.status === 'organized' ? `Organized into ${item.suggestion.destination}` : 'Waiting for your confirmation'}</p>{item.status !== 'organized' && <SuggestionEditor item={item} onChange={suggestion => update(next => { const target = next.inbox.find(i => i.id === item.id); if (target) target.suggestion = suggestion })} />}</div><div className="inbox-actions">{item.status !== 'organized' && <Button variant="soft" onClick={() => confirmOrganize(item)}>Confirm & organize</Button>}<IconButton label="Delete capture" onClick={() => update(next => { next.inbox = next.inbox.filter(i => i.id !== item.id) })}><Trash2 size={18} /></IconButton></div></article>)}</div></section>
  </div>
}

function SuggestionEditor({ item, onChange }) {
  const s = item.suggestion
  const set = (key, value) => onChange({ ...s, [key]: key === 'effort' ? Number(value) : value })
  return <div className="suggestion-grid"><label>Type<select value={s.type} onChange={e => set('type', e.target.value)}><option>Home task</option><option>Pet task</option><option>Calendar event</option><option>Possible goal</option><option>Note</option></select></label><label>Category<input value={s.category} onChange={e => set('category', e.target.value)} /></label><label>Timing<input value={s.timing} onChange={e => set('timing', e.target.value)} /></label><label>Effort<select value={s.effort} onChange={e => set('effort', e.target.value)}>{effortOptions.map(n => <option key={n}>{n}</option>)}</select></label><label>Destination<select value={s.destination} onChange={e => set('destination', e.target.value)}><option>Today</option><option>Weekend</option><option>Calendar</option><option>Home</option><option>Pets</option><option>Goals</option></select></label></div>
}

function SettingsView({ data, update, notify, cloud }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const savePeople = e => { e.preventDefault(); const f = new FormData(e.currentTarget); update(next => { const old = [...next.adults]; next.brandName = f.get('brandName') || 'Hearthline'; next.adults = [f.get('adult1') || 'You', f.get('adult2') || 'Household partner']; next.capacity[next.adults[0]] = next.capacity[old[0]] || { level: 'moderate', unavailable: '', note: '' }; next.capacity[next.adults[1]] = next.capacity[old[1]] || { level: 'moderate', unavailable: '', note: '' }; if (old[0] !== next.adults[0]) delete next.capacity[old[0]]; if (old[1] !== next.adults[1]) delete next.capacity[old[1]] }); notify('Household settings saved') }
  const reset = () => { localStorage.removeItem(HOUSEHOLD_CACHE_KEY); window.location.reload() }
  const copyInvite = async () => { await navigator.clipboard.writeText(cloud.household.invite_code); notify('Invite code copied') }
  return <div className="page settings-page"><PageHeader eyebrow="Settings" title="Make Hearthline yours" description={cloud ? 'Adjust the household and shared access.' : 'Adjust the household and local data.'} />
    <div className="settings-layout"><section className="settings-card"><div className="settings-heading"><span><Users /></span><div><h2>Household & app name</h2><p>The product name is provisional and can change whenever you like.</p></div></div><form className="form-grid" onSubmit={savePeople}><label className="span-2">App name<input name="brandName" defaultValue={data.brandName} /></label><label>First adult<input name="adult1" defaultValue={data.adults[0]} /></label><label>Second adult<input name="adult2" defaultValue={data.adults[1]} /></label><div className="form-actions span-2"><Button type="submit">Save names</Button></div></form></section>
      {cloud && <section className="settings-card cloud-account"><div className="settings-heading"><span><Users /></span><div><h2>Shared household access</h2><p>Each adult has a private account and shares the same live household.</p></div><Chip tone="sage">{cloud.status === 'saved' ? 'Saved' : cloud.status === 'offline' ? 'Offline' : titleCase(cloud.status)}</Chip></div><div className="cloud-details"><div><span>Household</span><strong>{cloud.household.name}</strong></div><div><span>Signed in as</span><strong>{cloud.user.email}</strong></div><div className="invite-code"><span>Invite the other person</span><strong>{cloud.household.invite_code}</strong><small>Share this code privately. It grants access after the second account is created.</small></div></div><div className="form-actions"><Button variant="outline" onClick={copyInvite}>Copy invite code</Button><Button variant="text" onClick={cloud.signOut}>Sign out</Button></div></section>}
      <section className="settings-card"><div className="settings-heading"><span><ShieldCheck /></span><div><h2>Storage & privacy</h2><p>{cloud ? 'Household records stay in the shared service. This browser keeps only your sign-in and any unsaved offline changes.' : 'This version stores household information only in this browser.'}</p></div></div>{cloud && <div className="trusted-device-note"><ShieldCheck size={17} /><span>Stay signed in only on a trusted device. Signing out clears the session, household cache, and queued changes from this browser.</span></div>}<div className="setting-row"><div><strong>Gentle reminders</strong><p>Use calm language and avoid intimidating backlog counts.</p></div><label className="switch"><input type="checkbox" aria-label="Gentle reminders" checked={data.settings.gentleReminders} onChange={e => update(next => { next.settings.gentleReminders = e.target.checked })} /><span aria-hidden="true" /></label></div><div className="setting-row"><div><strong>Local starter data</strong><p>Clear this device and return to an empty starter household.</p></div>{confirmReset ? <div className="reset-confirm"><Button variant="danger" onClick={reset}>Yes, reset</Button><Button variant="text" onClick={() => setConfirmReset(false)}>Cancel</Button></div> : <Button variant="outline" onClick={() => setConfirmReset(true)}>Reset local data</Button>}</div></section>
    </div>
  </div>
}

function FinancesView() {
  return <div className="page"><PageHeader eyebrow="Finances" title="A place for later" description="This area is intentionally separate from home tasks and estimated project costs." /><div className="finance-placeholder"><span><CircleDollarSign size={36} /></span><h2>Financial features are not configured.</h2><p>Hearthline will not show budgets, balances, spending charts, or financial alerts here.</p></div></div>
}

function DisplayMode({ mode, data, update, onClose, navigate }) {
  const completeEvening = () => update(next => next.routines.evening.items.forEach(i => i.status = 'given'))
  const eveningDone = data.routines.evening.items.every(i => i.status === 'given')
  const tomorrow = [...data.events].sort((a, b) => a.date.localeCompare(b.date))[0]
  return <div className={`display-mode ${mode}`}><header><div className="display-brand"><span><Flame /></span><strong>{data.brandName}</strong><small>{titleCase(mode)} mode</small></div><div className="display-time"><strong>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong><span>{friendlyDate()}</span></div><Button variant="light" icon={X} onClick={onClose}>Exit</Button></header>
    {mode === 'entry' && <div className="display-content"><section className="display-hero"><span className="eyebrow">At a glance</span><h1>The household is in good shape.</h1><p>One preparation item and an outdoor task are worth keeping in view.</p></section><div className="display-grid"><section className="display-panel"><span className="eyebrow">Today’s schedule</span>{data.events.slice(0, 2).map(event => <div className="display-row" key={event.id}><CalendarDays /><div><strong>{event.private ? 'Unavailable' : event.title}</strong><p>{shortDate(event.date)} · {event.time}</p></div></div>)}</section><section className="display-panel"><span className="eyebrow">Departure & preparation</span><div className="display-row"><ClipboardList /><div><strong>{tomorrow?.preparation || 'No preparation needed'}</strong><p>{tomorrow ? `For ${tomorrow.private ? 'an upcoming appointment' : tomorrow.title}` : 'The near future is open'}</p></div></div></section><section className="display-panel"><span className="eyebrow">Weather-sensitive</span>{data.tasks.filter(t => t.setting === 'outdoor' && t.status === 'open').slice(0, 2).map(task => <div className="display-row" key={task.id}><CloudSun /><div><strong>{task.title}</strong><p>{task.timing}</p></div></div>)}</section><section className="display-panel quick-capture" onClick={() => navigate('inbox')}><Mic /><div><strong>Quick voice capture</strong><p>Tap to open the household inbox</p></div><ArrowRight /></section></div></div>}
    {mode === 'office' && <div className="display-content"><section className="display-hero"><span className="eyebrow">Planning space</span><h1>What would help the household most?</h1><p>Review plans, care, projects, and shared records without the daily noise.</p></section><div className="office-tiles"><button onClick={() => navigate('plan')}><ClipboardList /><span>Household plan</span><small>Tasks, goals, capacity, and commitments together</small></button><button onClick={() => navigate('home')}><Home /><span>Home health</span><small>Suggestions and service records</small></button><button onClick={() => navigate('pets')}><PawPrint /><span>Pet care</span><small>Profiles and confirmed routines</small></button><button onClick={() => navigate('today')}><Sun /><span>Today</span><small>Only what matters right now</small></button><button onClick={() => navigate('settings')}><Settings /><span>Configuration</span><small>Household and display setup</small></button></div></div>}
    {mode === 'bedroom' && <div className="display-content bedroom-content"><section className={`bedroom-state ${eveningDone ? 'done' : ''}`}><span>{eveningDone ? <ShieldCheck /> : <Moon />}</span><p>{eveningDone ? 'Settle in' : 'A gentle close to the day'}</p><h1>{eveningDone ? 'Everything important is covered' : 'Evening care is still open'}</h1><p>{eveningDone ? 'Pet care is confirmed. Tomorrow is prepared enough for tonight.' : 'Confirm the routine when it is truly complete.'}</p>{!eveningDone && <Button variant="light" icon={Check} onClick={completeEvening}>Confirm evening routine</Button>}</section><section className="tomorrow-card"><span className="eyebrow">Tomorrow preview</span><div className="display-row"><Sun /><div><strong>{tomorrow?.private ? 'An appointment is on the calendar' : tomorrow?.title || 'No appointments scheduled'}</strong><p>{tomorrow ? `${shortDate(tomorrow.date)} at ${tomorrow.time}` : 'The morning is open.'}</p></div></div>{tomorrow?.preparation && <div className="display-row"><ClipboardList /><div><strong>Prepare</strong><p>{tomorrow.preparation}</p></div></div>}</section></div>}
  </div>
}

export default App
