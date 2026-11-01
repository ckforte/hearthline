export const effortOptions = [1, 2, 3, 5, 8]

export const seedData = {
  brandName: 'Hearthline',
  adults: ['You', 'Ryan'],
  routines: {
    morning: {
      time: '8:00 AM',
      status: 'open',
      items: [
        { id: 'med-handsome-am', pet: 'Handsome', action: 'Morning medication', status: 'open' },
        { id: 'med-fattest-am', pet: 'Fattest', action: 'Morning medication', status: 'open' },
        { id: 'med-tiny-am', pet: 'Tiny', action: 'Morning medication', status: 'open' },
        { id: 'feed-all-am', pet: 'All four', action: 'Breakfast & fresh water', status: 'open' },
      ],
    },
    evening: {
      time: '7:30 PM',
      status: 'open',
      items: [
        { id: 'med-handsome-pm', pet: 'Handsome', action: 'Evening medication', status: 'open' },
        { id: 'med-fattest-pm', pet: 'Fattest', action: 'Evening medication', status: 'open' },
        { id: 'med-tiny-pm', pet: 'Tiny', action: 'Evening medication', status: 'open' },
        { id: 'feed-all-pm', pet: 'All four', action: 'Dinner & fresh water', status: 'open' },
      ],
    },
  },
  tasks: [
    { id: 'task-1', title: 'Pick up Tiny’s medication refill', explanation: 'The current supply is getting low.', category: 'Pets', minutes: 25, effort: 2, dueWindow: 'By Thursday', timing: 'Weekday afternoon', setting: 'outdoor', help: 'either', cost: 'About $30', priority: 'must', claimedBy: '', status: 'open', date: 'Today', timeSensitive: true },
    { id: 'task-2', title: 'Test the sump pump', explanation: 'A quick check before the next stretch of wet weather.', category: 'Home', minutes: 20, effort: 2, dueWindow: 'This weekend', timing: 'Saturday morning', setting: 'indoor', help: 'diy', cost: '', priority: 'must', claimedBy: '', status: 'open', date: 'Weekend', timeSensitive: true },
    { id: 'task-3', title: 'Inspect and clear lower gutters', explanation: 'Leaves are collecting over the back porch.', category: 'Home', minutes: 50, effort: 3, dueWindow: 'Next two weeks', timing: 'Dry daylight hours', setting: 'outdoor', help: 'either', cost: '', priority: 'should', claimedBy: '', status: 'open', date: 'Weekend' },
    { id: 'task-4', title: 'Replace HVAC filter', explanation: 'A seasonal filter change helps airflow and system efficiency.', category: 'Home', minutes: 15, effort: 1, dueWindow: 'This month', timing: 'Any time', setting: 'indoor', help: 'diy', cost: 'About $18', priority: 'should', claimedBy: '', status: 'open', date: 'Upcoming' },
    { id: 'task-5', title: 'Walk the wooded edge after storms', explanation: 'Look for hanging limbs, blocked paths, and damaged trees.', category: 'Property', minutes: 45, effort: 3, dueWindow: 'Next dry weekend', timing: 'Sunday afternoon', setting: 'outdoor', help: 'either', cost: '', priority: 'should', claimedBy: '', status: 'open', date: 'Weekend' },
    { id: 'task-6', title: 'Sort one box of home records', explanation: 'A small next step toward an organized home archive.', category: 'Goals', minutes: 35, effort: 2, dueWindow: 'When capacity allows', timing: 'Quiet afternoon', setting: 'indoor', help: 'diy', cost: '', priority: 'could', claimedBy: '', status: 'open', date: 'Weekend', goalId: 'goal-3' },
    { id: 'task-7', title: 'Measure the bedroom wall', explanation: 'Needed before choosing storage or paint placement.', category: 'Goals', minutes: 15, effort: 1, dueWindow: 'This month', timing: 'Any time', setting: 'indoor', help: 'diy', cost: '', priority: 'could', claimedBy: '', status: 'open', date: 'Weekend', goalId: 'goal-2' },
  ],
  capacity: {
    You: { level: 'moderate', unavailable: 'Saturday, 10 AM–1 PM', note: '' },
    Ryan: { level: 'moderate', unavailable: 'Sunday morning', note: '' },
    generated: false,
  },
  events: [
    { id: 'event-1', title: 'Vet appointment — Tiny', date: '', time: '15:30', end: '16:30', source: 'Household', private: false, location: 'Greenwood Animal Clinic', preparation: 'Bring medication list and refill questions' },
    { id: 'event-2', title: 'Personal appointment', date: '', time: '10:00', end: '11:30', source: 'Ryan', private: true, location: '', preparation: '' },
  ],
  homeProfile: {
    ownership: 'Owner-occupied', state: 'Illinois', year: '1984', zone: 'USDA Zone 6', hvac: 'Central HVAC', heat: 'Wood-burning stove', basement: true, sumpPump: true, septic: true, garage: true, lawn: true, gutters: true, acreage: '1–2 wooded acres at the back', notes: '',
  },
  recommendations: [
    { id: 'rec-1', title: 'Check smoke and carbon-monoxide detectors', why: 'Working detectors are a core household safety layer, especially with a wood-burning stove.', suggestedBecause: 'Wood stove and 1984 home are in the profile.', effort: 1, timing: 'Twice yearly or after battery alerts', pro: 'DIY; replace units that are past manufacturer life.', confidence: 'High', status: 'suggested' },
    { id: 'rec-2', title: 'Confirm chimney inspection history', why: 'Creosote buildup and flue damage can increase fire risk.', suggestedBecause: 'The home uses a wood-burning stove.', effort: 2, timing: 'Before the heating season', pro: 'A certified chimney professional may be appropriate.', confidence: 'High', status: 'suggested' },
    { id: 'rec-3', title: 'Learn the last septic service date', why: 'A known service history makes future care easier to plan.', suggestedBecause: 'The home profile lists a septic system.', effort: 1, timing: 'A low-pressure research task this month', pro: 'Check records or contact the prior service provider.', confidence: 'Medium — service history is unknown', status: 'suggested' },
    { id: 'rec-4', title: 'Inspect basement for seasonal moisture', why: 'Early signs are easier to address before they become persistent.', suggestedBecause: 'The home has a basement and sump pump.', effort: 2, timing: 'After heavy rain', pro: 'DIY visual check; call a professional for persistent water.', confidence: 'High', status: 'suggested' },
    { id: 'rec-5', title: 'Plan a spring wooded-edge walk', why: 'Dead limbs, invasive growth, ticks, and storm damage can emerge seasonally.', suggestedBecause: 'The property includes wooded acreage in Zone 6.', effort: 3, timing: 'Early spring, then after major storms', pro: 'Use an arborist for elevated or hazardous limbs.', confidence: 'Medium', status: 'suggested' },
    { id: 'rec-6', title: 'Locate and label the main water shutoff', why: 'Knowing the shutoff location can limit damage during a plumbing leak.', suggestedBecause: 'This is useful baseline information for an older home.', effort: 1, timing: 'When convenient this month', pro: 'DIY research; ask a plumber if it cannot be found.', confidence: 'Medium', status: 'suggested' },
    { id: 'rec-7', title: 'Clean the dryer vent path', why: 'Lint buildup can reduce performance and increase fire risk.', suggestedBecause: 'Routine appliance care for an owner-occupied home.', effort: 3, timing: 'Yearly', pro: 'DIY for an accessible short run; professional for long or roof vents.', confidence: 'Medium', status: 'queued' },
    { id: 'rec-8', title: 'Inspect garage-door safety reverse', why: 'The door should reverse when it meets an obstruction.', suggestedBecause: 'The home profile includes a garage.', effort: 1, timing: 'Twice yearly', pro: 'A garage-door technician can correct unsafe behavior.', confidence: 'High', status: 'queued' },
    { id: 'rec-9', title: 'Review freeze-weather preparation', why: 'Outdoor faucets, vulnerable plumbing, and emergency supplies benefit from a pre-freeze check.', suggestedBecause: 'Illinois and Zone 6 have sustained freezing periods.', effort: 3, timing: 'Early fall', pro: 'Usually DIY; seek help for vulnerable plumbing.', confidence: 'High', status: 'queued' },
    { id: 'rec-10', title: 'Seasonal lawn and drainage walk', why: 'Pooling water and soil changes can reveal drainage issues around the foundation.', suggestedBecause: 'The profile includes lawn, gutters, and basement.', effort: 2, timing: 'Spring and after severe weather', pro: 'Professional help may suit grading or persistent drainage issues.', confidence: 'Medium', status: 'queued' },
  ],
  history: [
    { id: 'history-1', title: 'HVAC seasonal service', date: '2026-09-18', provider: 'Prairie Air', notes: 'System checked; filter size 16×25×1.', next: 'Replace filter in December', files: [] },
  ],
  pets: [
    { id: 'handsome', name: 'Handsome', species: 'Cat', initials: 'HA', color: 'sage', medication: 'Twice daily with food', vet: 'Greenwood Animal Clinic', vetPhone: '(555) 014-2180', notes: 'Prefers medication mixed into a small spoonful of wet food.', appointment: 'Annual visit due in February', supplies: 'Medication refill in 12 days', history: ['Oct 18 — Medication refill picked up', 'Sep 6 — Annual exam'] },
    { id: 'fattest', name: 'Fattest', species: 'Cat', initials: 'FA', color: 'clay', medication: 'Twice daily', vet: 'Greenwood Animal Clinic', vetPhone: '(555) 014-2180', notes: 'Calmest when approached near the kitchen window.', appointment: 'No appointment scheduled', supplies: 'Wet food supply looks good', history: ['Oct 12 — Medication dose adjusted', 'Aug 21 — Dental check'] },
    { id: 'baby-kitty', name: 'Baby Kitty', species: 'Cat', initials: 'BK', color: 'gold', medication: 'No current medication', vet: 'Greenwood Animal Clinic', vetPhone: '(555) 014-2180', notes: 'Indoor cat. Watch for door-dashing during deliveries.', appointment: 'Wellness visit next spring', supplies: 'Add litter to next shopping list', history: ['Mar 14 — Wellness exam'] },
    { id: 'tiny', name: 'Tiny', species: 'Dog', initials: 'TI', color: 'blue', medication: 'Twice daily', vet: 'Greenwood Animal Clinic', vetPhone: '(555) 014-2180', notes: 'Takes pills easily in a soft treat. Sensitive to thunderstorms.', appointment: 'Nov 14 at 3:30 PM', supplies: 'Medication refill needed this week', history: ['Oct 30 — Refill requested', 'Jul 11 — Wellness exam'] },
  ],
  goals: [
    { id: 'goal-1', title: 'Make better use of the wooded property', description: 'Create a safe, inviting path and a thoughtful plan for the back acreage.', progress: 20, next: 'Walk the boundary and photograph areas of interest', status: 'active' },
    { id: 'goal-2', title: 'Improve the bedroom', description: 'Make the room calmer, more functional, and easier to maintain.', progress: 35, next: 'Measure the main wall and storage gaps', status: 'active' },
    { id: 'goal-3', title: 'Organize important home records', description: 'Bring service history, manuals, and essential documents into one reliable place.', progress: 45, next: 'Sort one box and label keep / scan / recycle', status: 'active' },
  ],
  inbox: [
    { id: 'inbox-1', text: 'The garage door sounds strange.', created: 'Today', suggestion: { type: 'Home task', category: 'Garage', timing: 'This weekend', effort: 2, destination: 'Home' }, status: 'unorganized' },
  ],
  settings: { weekStarts: 'Sunday', gentleReminders: true, displayMode: 'Normal' },
}

export function seededData() {
  const clone = structuredClone(seedData)
  const now = new Date()
  const nextDay = new Date(now)
  nextDay.setDate(now.getDate() + 10)
  clone.events[0].date = nextDay.toISOString().slice(0, 10)
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 6)
  clone.events[1].date = nextWeek.toISOString().slice(0, 10)
  return clone
}
