import { addDays, format, subDays } from 'date-fns'
import type { ShipEvent, DailyLog, ChangelogEntry, ContentPiece, EventCategory, EventSource, Mood } from './types'

// Deterministic pseudo-random so the demo looks the same every load
let seedState = 42
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648
  return seedState / 2147483648
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }

const COMMITS = [
  'feat: add Stripe checkout flow', 'fix: auth token refresh race condition',
  'feat: PDF receipt generator with school branding', 'refactor: extract payment webhook handler',
  'feat: bursar dashboard with animated counters', 'fix: timezone bug in streak calculation',
  'feat: command palette with fuzzy search', 'chore: upgrade to Tailwind 4',
  'feat: weekly digest email template', 'fix: mobile bottom nav safe-area padding',
  'feat: contribution heatmap component', 'perf: memoize timeline event cards',
  'feat: Paystack test-mode integration', 'fix: modal focus trap on iOS Safari',
  'feat: AI writer tone selector', 'feat: public changelog page',
  'fix: recharts tooltip theme on dark', 'feat: onboarding flow with progress dots',
  'feat: achievement unlock overlay', 'refactor: zustand store slices',
]
const FEATURES = [
  'Shipped the AI Writer with three voices', 'Launched public profile pages',
  'Built the weekly digest generator', 'Added GitHub webhook capture',
  'Shipped command palette (⌘K)', 'Built the evening reflection flow',
  'Added streak system with fire gradient', 'Shipped contribution heatmap',
]
const DEPLOYS = [
  'Deployed fee portal v0.3 to production', 'Deployed dent.app preview',
  'Deployed hotfix for auth callback', 'Production deploy — landing page v2',
  'Deployed edge function: weekly-digest', 'Deployed n8n workflow updates',
]
const BUGS = [
  'Fixed double-charge on retry payments', 'Fixed streak resetting at midnight UTC',
  'Fixed iOS keyboard covering the composer', 'Fixed heatmap off-by-one on Sundays',
  'Fixed OAuth redirect loop on Safari',
]
const REVENUE = [
  'New Pro subscription — $19 MRR', 'Annual plan purchased — $190',
  'First school paid deposit ₦150,000', 'Upgraded customer: Free → Pro',
]
const CUSTOMERS = [
  'First school signed LOI 🎉', 'New signup from Twitter thread',
  '3 new waitlist signups', 'Demo call booked with second school',
]
const MILESTONES = [
  'Crossed 100 total commits on Dent', '21-day shipping streak',
  'First external user logged an event', 'Landing page hit 1,000 visits',
]
const LEARNINGS = [
  'Learned: Framer Motion layoutId makes card morphs trivial',
  'Learned: Supabase RLS policies need explicit select grants',
  'Learned: iOS standalone PWAs need safe-area-inset handling',
  'Learned: shorter tweets with concrete numbers get 3x engagement',
]

const CAT_POOL: [EventCategory, string[], EventSource][] = [
  ['commit', COMMITS, 'github'],
  ['deployment', DEPLOYS, 'vercel'],
  ['feature', FEATURES, 'manual'],
  ['bugfix', BUGS, 'github'],
  ['revenue', REVENUE, 'stripe'],
  ['customer', CUSTOMERS, 'stripe'],
  ['milestone', MILESTONES, 'manual'],
  ['learning', LEARNINGS, 'manual'],
]
// Weights: commits heavy, like real life
const WEIGHTS = [0.40, 0.15, 0.15, 0.10, 0.05, 0.05, 0.05, 0.05]

function weightedCat(): [EventCategory, string[], EventSource] {
  const r = rand()
  let acc = 0
  for (let i = 0; i < WEIGHTS.length; i++) {
    acc += WEIGHTS[i]
    if (r < acc) return CAT_POOL[i]
  }
  return CAT_POOL[0]
}

export function generateSeed() {
  const events: ShipEvent[] = []
  const dailyLogs: DailyLog[] = []
  const today = new Date()
  let id = 0

  for (let d = 89; d >= 0; d--) {
    const day = subDays(today, d)
    const dateStr = format(day, 'yyyy-MM-dd')
    // Guarantee last-21-day streak; earlier days ~75% active
    const active = d < 21 ? true : rand() < 0.75
    if (!active) continue
    const count = 1 + Math.floor(rand() * (d < 7 ? 7 : 5))
    for (let i = 0; i < count; i++) {
      const [category, pool, source] = weightedCat()
      const hour = 8 + Math.floor(rand() * 14)
      events.push({
        id: `ev_${id++}`,
        source, category,
        title: pick(pool),
        importance: 3 + Math.floor(rand() * 7),
        isPinned: false,
        eventDate: dateStr,
        eventTime: new Date(day.setHours(hour, Math.floor(rand() * 60), 0, 0)).toISOString(),
      })
    }
    if (rand() < 0.7) {
      const moods: Mood[] = ['fire', 'good', 'good', 'meh', 'tough']
      dailyLogs.push({
        id: `dl_${id++}`,
        logDate: dateStr,
        whatIBuilt: pick(FEATURES),
        whatBlockedMe: rand() < 0.4 ? pick(['Flaky OAuth in dev', 'Waiting on API keys', 'Nothing major']) : '',
        whatILearned: pick(LEARNINGS).replace('Learned: ', ''),
        energyLevel: 2 + Math.floor(rand() * 4),
        mood: pick(moods),
      })
    }
  }

  // Pin some milestones
  events.filter(e => e.category === 'milestone').slice(0, 3).forEach(e => (e.isPinned = true))

  const changelog: ChangelogEntry[] = [
    {
      id: 'cl_1', versionTag: 'v0.4.0', title: 'The AI Writer arrives',
      body: '- Three voices: **Founder**, **Technical**, **Storytelling**\n- Generate tweets, LinkedIn posts, newsletters and changelogs from your week\n- Typewriter preview while Claude writes',
      publishedAt: format(subDays(today, 3), 'yyyy-MM-dd'),
    },
    {
      id: 'cl_2', versionTag: 'v0.3.2', title: 'Streaks & achievements',
      body: '- 32 achievements across 4 rarity tiers\n- Streak engine with proper timezone handling\n- Unlock animation with particle burst',
      publishedAt: format(subDays(today, 10), 'yyyy-MM-dd'),
    },
    {
      id: 'cl_3', versionTag: 'v0.3.0', title: 'The Timeline',
      body: '- Infinite-scroll timeline of everything you ship\n- Category filters with animated transitions\n- Pin your proudest moments',
      publishedAt: format(subDays(today, 18), 'yyyy-MM-dd'),
    },
    {
      id: 'cl_4', versionTag: 'v0.2.0', title: 'GitHub capture is live',
      body: '- Webhook capture for commits, PRs and issues\n- AI categorization: feat → feature, fix → bugfix\n- Events flow straight into your Today view',
      publishedAt: format(subDays(today, 32), 'yyyy-MM-dd'),
    },
  ]

  const content: ContentPiece[] = [
    {
      id: 'cp_1', platform: 'twitter', tone: 'founder', title: 'Week 21 recap', status: 'published',
      body: 'This week I shipped:\n→ Paystack integration for school fees\n→ PDF receipt generator with school branding\n→ Bursar dashboard with animated counters\n→ Email notifications via n8n\n\nBuilding @NaltoHQ in public. Week 21.',
      createdAt: format(subDays(today, 4), 'yyyy-MM-dd'),
    },
    {
      id: 'cp_2', platform: 'linkedin', tone: 'storytelling', title: 'The first LOI', status: 'published',
      body: 'Three months ago I started building a fee portal for schools in Lagos.\n\nToday the first school signed an LOI.\n\nWhat worked: showing up every day, shipping something visible every week, and letting the product speak in demos instead of slides.',
      createdAt: format(subDays(today, 8), 'yyyy-MM-dd'),
    },
    {
      id: 'cp_3', platform: 'twitter', tone: 'technical', title: 'Streak engine notes', status: 'draft',
      body: 'Streaks look trivial until timezones show up.\n\nThe fix: store event_date as a plain date in the user\'s tz, never UTC timestamps. Count consecutive days backwards from today. 40 lines total.',
      createdAt: format(subDays(today, 1), 'yyyy-MM-dd'),
    },
  ]

  return { events, dailyLogs, changelog, content }
}

export function nextDate(date: Date): Date { return addDays(date, 1) }
