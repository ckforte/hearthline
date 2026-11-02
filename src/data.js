export const effortOptions = [1, 2, 3, 5, 8]

const initialsFor = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'P'

export function seededData(options = {}) {
  const adult1 = String(options.adult1 || 'You').trim()
  const adult2 = String(options.adult2 || 'Household partner').trim()
  const petNames = Array.isArray(options.petNames) ? options.petNames.map(name => String(name).trim()).filter(Boolean) : []
  const firstTask = String(options.firstTask || '').trim()
  const colors = ['sage', 'clay', 'gold', 'blue']
  const pets = petNames.map((name, index) => ({
    id: `pet-${index + 1}`,
    name,
    species: 'Pet',
    initials: initialsFor(name),
    color: colors[index % colors.length],
    medication: 'No current medication',
    vet: '',
    vetPhone: '',
    notes: '',
    appointment: 'No appointment scheduled',
    supplies: 'No supply reminder',
  }))
  const routineItems = (period) => pets.map((pet, index) => ({
    id: `care-${period}-${index + 1}`,
    pet: pet.name,
    action: period === 'morning' ? 'Breakfast & fresh water' : 'Dinner & fresh water',
    status: 'open',
  }))
  const tasks = firstTask ? [{
    id: 'starter-task',
    title: firstTask,
    explanation: 'Added during household setup.',
    category: 'Household',
    minutes: 15,
    effort: 1,
    dueWindow: 'Today',
    timing: 'Flexible',
    setting: 'indoor',
    help: 'either',
    cost: '',
    priority: 'should',
    claimedBy: '',
    status: 'open',
    date: 'Today',
    timeSensitive: false,
  }] : []

  return {
    brandName: 'Hearthline',
    adults: [adult1, adult2],
    routines: {
      morning: { time: '8:00 AM', status: 'open', items: routineItems('morning') },
      evening: { time: '7:30 PM', status: 'open', items: routineItems('evening') },
      confirmations: [],
    },
    tasks,
    capacity: {
      [adult1]: { level: 'moderate', unavailable: '', note: '' },
      [adult2]: { level: 'moderate', unavailable: '', note: '' },
      generated: false,
    },
    events: [],
    homeProfile: {
      ownership: '', state: '', year: '', zone: '', hvac: '', heat: '', basement: false,
      sumpPump: false, septic: false, garage: false, lawn: false, gutters: false, acreage: '', notes: '',
    },
    recommendations: [],
    history: [],
    pets,
    goals: [],
    inbox: [],
    settings: { weekStarts: 'Sunday', gentleReminders: true, scopeReview: null },
  }
}
