import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { Plus, Sparkles, PenLine, Search, CalendarRange, Flame, Hammer, SlidersHorizontal, Zap } from 'lucide-react'
import { useDent, todayStr } from '../lib/store'
import { SOURCE_LABEL, CATEGORY_META, levelForXP, type Mood, type EventCategory } from '../lib/types'
import { Page, GlassCard, XPBar, Checkmark, SectionTitle, CategoryPill, AICore } from '../components/ui'
import { AddEventModal } from '../components/AddEventModal'
import { Mascot } from '../components/Mascot'
import { repoOf } from '../lib/github'

// Builder moods — words first, not emoji soup
const MOODS: { key: Mood; label: string; emoji: string }[] = [
  { key: 'fire', label: 'Flow state', emoji: '🔥' },
  { key: 'good', label: 'Solid', emoji: '💪' },
  { key: 'meh', label: 'Grinding', emoji: '⛏️' },
  { key: 'tough', label: 'Heavy day', emoji: '🌧️' },
  { key: 'burned_out', label: 'On fumes', emoji: '🪫' },
]

// The energy tank: not a random 1–5, each level means something
const TANK = [
  { n: 1, label: 'Empty', desc: 'Ran on fumes. Tomorrow starts slow, and that’s fine.', color: '#ef4444' },
  { n: 2, label: 'Low', desc: 'A grind of a day. Protect tomorrow morning.', color: '#f59e0b' },
  { n: 3, label: 'Half', desc: 'Steady, sustainable pace. This is the marathon setting.', color: '#eab308' },
  { n: 4, label: 'Charged', desc: 'Momentum day. Ride it into tomorrow’s first task.', color: '#22c55e' },
  { n: 5, label: 'Full send', desc: 'Could have gone all night. Bottle this feeling.', color: '#10b981' },
]

// Rotating prompts so the logbook never feels like a form
const PROMPTS = [
  {
    built: 'What did you ship today — even the small stuff?',
    blocked: 'What fought back?',
    learned: 'What do you know now that morning-you didn’t?',
  },
  {
    built: 'What exists tonight that didn’t exist this morning?',
    blocked: 'Where did you lose the most time?',
    learned: 'What would you tell another builder facing the same day?',
  },
  {
    built: 'What moved the project forward today?',
    blocked: 'What almost made you close the laptop?',
    learned: 'One lesson worth remembering in a month?',
  },
]

const QUICK_CATS: EventCategory[] = ['commit', 'feature', 'bugfix', 'deployment', 'revenue', 'customer', 'milestone', 'learning', 'idea']

// Each category asks its own question — a conversation, not a form
const CAT_PROMPTS: Partial<Record<EventCategory, string>> = {
  commit: 'What did you just push?',
  feature: 'What can users do now that they couldn’t this morning?',
  bugfix: 'Which bug did you finally kill?',
  deployment: 'What did you just deploy — and where?',
  revenue: 'Money landed! How much, from where? First payout? Log the number.',
  customer: 'Who just became a customer — and what did they say?',
  milestone: 'What milestone did you just hit? Numbers make it real.',
  learning: 'What did you just learn the hard way?',
  idea: 'What idea just hit you? Trap it before it escapes.',
}

// Money and milestone ships deserve the full story — the details drawer
// opens itself so the amount, source and proof get captured for the AI.
const DETAIL_CATS: EventCategory[] = ['revenue', 'customer', 'milestone']

const SHIP_CHEERS = ['Logged. The streak feeds. 🔥', 'Another one in the book.', 'Future-you says thanks.', 'That’s how empires start.', 'The log never forgets.']

const EFFORT = [
  { key: 'Quick win', hint: '< 30 min' },
  { key: 'Solid session', hint: '1–3 hrs' },
  { key: 'Deep work', hint: 'half day+' },
]

export default function Today() {
  const { profile, events, dailyLogs, saveDailyLog, addEvent } = useDent()
  const [params, setParams] = useSearchParams()
  const [addOpen, setAddOpen] = useState(params.get('add') === '1')
  const [xpFloat, setXpFloat] = useState(false)
  const navigate = useNavigate()

  const today = todayStr()
  const todaysEvents = useMemo(() => events.filter(e => e.eventDate === today), [events, today])
  const existingLog = dailyLogs.find(l => l.logDate === today)
  const level = levelForXP(profile.builderScore)
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Late-night shift' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const xpToday = todaysEvents.length * 10 + (existingLog ? 25 : 0)
  const prompts = PROMPTS[new Date().getDate() % PROMPTS.length]

  // Inline composer — the fastest path from "did a thing" to "logged"
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCat, setQuickCat] = useState<EventCategory>('commit')
  // Open by default — the note/proof/effort fields ARE the log's memory,
  // and the AI answers are only as detailed as what lands here.
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [effort, setEffort] = useState<string | null>(null)
  const [shipKind, setShipKind] = useState<string | null>(null)
  const [cheer, setCheer] = useState<string | null>(null)

  const [capHit, setCapHit] = useState(false)
  const quickShip = () => {
    if (!quickTitle.trim()) return
    const parts: string[] = []
    if (note.trim()) parts.push(note.trim())
    if (shipKind) parts.push(`Belongs to: ${shipKind}`)
    if (effort) parts.push(`Effort: ${effort}`)
    if (link.trim()) parts.push(`Link: ${link.trim()}`)
    const ok = addEvent({ title: quickTitle.trim(), category: quickCat, description: parts.join('\n') || undefined })
    if (!ok) { setCapHit(true); return }
    setQuickTitle(''); setNote(''); setLink(''); setEffort(null); setShipKind(null)
    setCheer(SHIP_CHEERS[Math.floor(Math.random() * SHIP_CHEERS.length)])
    setTimeout(() => setCheer(null), 2200)
  }

  // Ongoing series — the projects you keep showing up for, one tap to continue
  const ongoing = useMemo(() => {
    const map = new Map<string, { title: string; category: EventCategory; days: Set<string>; lastDate: string }>()
    for (const e of events) {
      const key = e.title.replace(/\s*—\s*day \d+$/i, '').trim().toLowerCase()
      const entry = map.get(key)
      if (entry) {
        entry.days.add(e.eventDate)
        if (e.eventDate > entry.lastDate) entry.lastDate = e.eventDate
      } else {
        map.set(key, { title: e.title.replace(/\s*—\s*day \d+$/i, '').trim(), category: e.category, days: new Set([e.eventDate]), lastDate: e.eventDate })
      }
    }
    return [...map.values()].filter(v => v.days.size >= 2).sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 4)
  }, [events])

  // 14-day pulse: the shipping rhythm, front and center
  const pulse = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
      return { date: d, count: events.filter(e => e.eventDate === d).length }
    })
  }, [events])
  const maxPulse = Math.max(1, ...pulse.map(p => p.count))

  // Last ship, for the project reminder
  const lastShipTime = useMemo(
    () => events.reduce<number>((max, e) => Math.max(max, new Date(e.eventTime).getTime()), 0),
    [events],
  )
  const hoursSinceShip = lastShipTime ? Math.max(0, Math.round((Date.now() - lastShipTime) / 36e5)) : null
  const streakAtRisk = todaysEvents.length === 0 && hour >= 15

  // The companion speaks once a day — specific, warm, never spammy.
  // (Backend version: n8n cron → Claude API → nudges table. This is the local twin.)
  const nudge = useMemo(() => {
    const week = pulse.slice(7).reduce((a, p) => a + p.count, 0)
    const best = [...pulse].sort((a, b) => b.count - a.count)[0]
    const lastLog = dailyLogs[0]
    const day = new Date().getDate()
    const options = [
      todaysEvents.length > 0
        ? `${todaysEvents.length} ship${todaysEvents.length > 1 ? 's' : ''} already today — and ${week} this week. ${profile.streakCurrent} days straight now. Whatever you're doing, it's working.`
        : `Quiet so far today, but your ${profile.streakCurrent}-day streak says you always show up. One small ship counts.`,
      best.count > 0
        ? `Your best recent day was ${format(new Date(best.date + 'T12:00:00'), 'EEEE')} — ${best.count} ships. Days like that start with one push before lunch.`
        : `Every builder has slow stretches. The log remembers the comebacks, not the pauses.`,
      lastLog?.whatILearned
        ? `Last log you wrote: “${lastLog.whatILearned.slice(0, 80)}”. That lesson is already paying rent.`
        : `${profile.totalShips} things shipped and counting. ${profile.projectName} exists because you kept going.`,
    ]
    return options[day % options.length]
  }, [pulse, todaysEvents.length, profile, dailyLogs])

  const [built, setBuilt] = useState(existingLog?.whatIBuilt ?? '')
  const [blocked, setBlocked] = useState(existingLog?.whatBlockedMe ?? '')
  const [learned, setLearned] = useState(existingLog?.whatILearned ?? '')
  const [energy, setEnergy] = useState(existingLog?.energyLevel ?? 3)
  const [mood, setMood] = useState<Mood>(existingLog?.mood ?? 'good')
  const [reflectOpen, setReflectOpen] = useState(hour >= 18 && !existingLog)

  const [sealedToast, setSealedToast] = useState<string | null>(null)
  const saveReflection = () => {
    const firstSealToday = !existingLog
    saveDailyLog({ logDate: today, whatIBuilt: built, whatBlockedMe: blocked, whatILearned: learned, energyLevel: energy, mood })
    // XP floats only when the day is sealed for the FIRST time — updates
    // don't re-award. Either way the save is confirmed loudly.
    if (firstSealToday) {
      setXpFloat(true)
      setTimeout(() => setXpFloat(false), 1600)
    }
    setSealedToast(firstSealToday ? 'Day sealed ✓ +25 XP — see you tomorrow' : 'Log updated ✓ Saved')
    setTimeout(() => setSealedToast(null), 2600)
  }

  // Which repos shipped today (from GitHub-synced events) — lets the builder
  // focus the post on one project instead of everything at once.
  const todaysRepos = useMemo(
    () => [...new Set(todaysEvents.map(repoOf).filter((r): r is string => !!r))],
    [todaysEvents],
  )
  const [focusRepo, setFocusRepo] = useState<string | null>(null)

  // Hand today's ships straight to the writer — it opens on the "Today" range
  // so the post is analyzed from exactly what you shipped (commit + deploy and
  // all) rather than a whole week of noise. A chosen repo rides along.
  const postToday = () => {
    sessionStorage.setItem('shiplog-handoff', JSON.stringify({ mode: 'ships', range: 0, tone: profile.tone, repo: focusRepo }))
    navigate('/app/write')
  }

  return (
    <Page>
      {/* ── Hero: greeting + streak ring + mascot ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}
        className="glass noise relative overflow-hidden !rounded-3xl p-6 md:p-8"
      >
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{format(new Date(), 'EEEE · MMMM d')}</div>
            <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight md:text-4xl">
              {greeting}, <span className="text-gradient">{profile.displayName}</span>
            </h1>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-secondary">
              {todaysEvents.length > 0
                ? <>You've shipped <span className="font-semibold text-primary">{todaysEvents.length} {todaysEvents.length === 1 ? 'thing' : 'things'}</span> today. The log is watching — keep going.</>
                : <>The workshop is quiet. One small ship is all it takes to keep the fire alive.</>}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <StreakRing days={profile.streakCurrent} />
              <div className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-secondary">
                Lv {level.level} · {level.name}
              </div>
              <div className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-secondary">
                +{xpToday} XP today
              </div>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 18 }}
            className="hidden shrink-0 sm:block"
          >
            <Mascot size={116} />
          </motion.div>
        </div>

        {/* Ship pulse — the main deal */}
        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Ship pulse · last 14 days</span>
            <span className="font-mono text-[10px] text-muted">{pulse.reduce((a, p) => a + p.count, 0)} ships</span>
          </div>
          <div className="flex h-20 items-end gap-1.5">
            {pulse.map((p, i) => (
              <motion.div
                key={p.date}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(10, (p.count / maxPulse) * 100)}%`, opacity: 1 }}
                whileHover={{ scaleY: 1.06, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
                title={`${format(new Date(p.date + 'T12:00:00'), 'EEE d MMM')}: ${p.count} ships`}
                className="group relative flex-1 origin-bottom cursor-default rounded-t-md"
                style={{
                  background: i === 13
                    ? 'linear-gradient(180deg, #ec4899, #6366f1)'
                    : p.count > 0
                      ? `linear-gradient(180deg, rgba(99,102,241,${0.35 + (p.count / maxPulse) * 0.55}), rgba(99,102,241,0.15))`
                      : 'rgba(255,255,255,0.05)',
                  boxShadow: i === 13 ? '0 0 22px rgba(99,102,241,0.55)' : undefined,
                }}
              >
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {p.count}
                </span>
                {i === 13 && (
                  <motion.span
                    className="absolute inset-0 rounded-t-md bg-white/25"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {pulse.map((p, i) => (
              <span key={p.date} className={`flex-1 text-center font-mono text-[8px] ${i === 13 ? 'font-bold text-accent' : 'text-muted/70'}`}>
                {i === 13 ? 'now' : format(new Date(p.date + 'T12:00:00'), 'EEEEE')}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* AI companion — one short note a day, receipts included */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-4"
      >
        <span className="mt-0.5"><AICore size={24} color="#a5b4fc" /></span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent">Your companion</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-secondary">{nudge}</p>
        </div>
      </motion.div>

      {/* ── Streak-risk / project reminder ── */}
      <AnimatePresence>
        {streakAtRisk ? (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={() => setAddOpen(true)}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-warning/30 bg-warning/[0.07] p-4 text-left"
          >
            <Flame size={18} className="shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-primary">Your {profile.streakCurrent}-day streak is on the line</div>
              <div className="text-xs text-secondary">Nothing logged today. One small ship before midnight keeps it alive — even a commit counts.</div>
            </div>
            <span className="shrink-0 rounded-lg bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning">Log a ship</span>
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-4"
          >
            <Hammer size={18} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-primary">{profile.projectName} is waiting on you</div>
              <div className="text-xs text-secondary">
                {hoursSinceShip !== null && hoursSinceShip < 24
                  ? `Last ship ${hoursSinceShip <= 1 ? 'under an hour' : `${hoursSinceShip}h`} ago. The momentum is yours — what's next on ${profile.projectName}?`
                  : `It's been a minute. Open the project, pick the smallest task, ship it.`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TODAY'S LOG — one system: ship it, see it, close the day ── */}
      <GlassCard className="mt-4 !p-0 overflow-hidden">
        {/* Composer */}
        <div className="border-b border-line p-5">
          <div className="flex items-center justify-between">
            <SectionTitle>Today's Log</SectionTitle>
            <span className="font-mono text-xs text-muted">{todaysEvents.length} ships · +{xpToday} XP</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CATS.map(c => (
              <button key={c} onClick={() => { setQuickCat(c); if (DETAIL_CATS.includes(c)) setDetailsOpen(true) }}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all"
                style={quickCat === c
                  ? { color: CATEGORY_META[c].color, background: CATEGORY_META[c].bg, borderColor: CATEGORY_META[c].color }
                  : { color: 'var(--ink-2)', borderColor: 'var(--edge)' }}>
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
          {/* Ongoing work — one tap continues the story */}
          {ongoing.length > 0 && (
            <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
              {ongoing.map(o => (
                <button
                  key={o.title}
                  type="button"
                  onClick={() => { setQuickTitle(`${o.title} — day ${o.days.size + 1}`); setQuickCat(o.category) }}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-[11px] text-secondary transition-colors hover:border-accent/50 hover:text-primary"
                >
                  <span className="font-mono font-bold" style={{ color: CATEGORY_META[o.category].color }}>d{o.days.size + 1}</span>
                  <span className="max-w-36 truncate">{o.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative mt-2.5 flex gap-2">
            <input
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickShip() } }}
              placeholder={CAT_PROMPTS[quickCat] ?? 'What did you just ship?'}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm placeholder:text-muted"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={quickShip}
              disabled={!quickTitle.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-40"
            >
              <Plus size={14} /> Ship
            </motion.button>
            <button
              type="button"
              onClick={() => setDetailsOpen(o => !o)}
              title="Add details — note, proof link, effort"
              className={`shrink-0 rounded-xl border px-3 transition-colors ${detailsOpen ? 'border-accent/60 text-accent' : 'border-line text-muted hover:border-line-hover hover:text-secondary'}`}
            >
              <SlidersHorizontal size={15} />
            </button>
            <AnimatePresence>
              {cheer && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: -26 }} exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                  className="pointer-events-none absolute right-16 top-0 whitespace-nowrap font-mono text-xs font-bold text-accent"
                >
                  +10 XP · {cheer}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Free-plan monthly cap reached */}
          <AnimatePresence>
            {capHit && (
              <motion.button
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                onClick={() => navigate('/pricing')}
                className="mt-2.5 flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-warning/40 bg-warning/[0.08] px-3.5 py-2.5 text-left text-xs"
              >
                <span className="text-secondary">Free plan logs 30 ships a month, and you've hit it. Your GitHub commits still sync — manual logging unlocks with Pro.</span>
                <span className="ml-auto shrink-0 font-semibold text-warning">Go Pro →</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Inline details — everything the modal had, right here */}
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 space-y-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder={DETAIL_CATS.includes(quickCat)
                      ? 'The details the AI will quote back — amount, who paid, which plan, how it felt.'
                      : 'The story behind it — what changed, why it matters (optional)'}
                    className="w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm placeholder:text-muted"
                  />
                  <input
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    placeholder="Proof link — PR, deploy URL, screenshot (optional)"
                    className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs placeholder:text-muted"
                  />
                  <div className="flex gap-1.5">
                    {EFFORT.map(ef => (
                      <button
                        key={ef.key}
                        type="button"
                        onClick={() => setEffort(effort === ef.key ? null : ef.key)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-center transition-all ${effort === ef.key ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-hover'}`}
                      >
                        <span className={`text-[11px] font-semibold ${effort === ef.key ? 'text-accent' : 'text-secondary'}`}>{ef.key}</span>
                        <span className="ml-1 text-[9px] text-muted">{ef.hint}</span>
                      </button>
                    ))}
                  </div>
                  {/* Is this a fresh start or the ongoing grind? The AI uses it to tell the story right. */}
                  <div className="flex gap-1.5">
                    {[
                      { key: '🚀 New project', hint: 'day one' },
                      { key: '🔧 Existing build', hint: 'the grind' },
                      { key: '⚡ One-off', hint: 'side quest' },
                    ].map(k => (
                      <button
                        key={k.key}
                        type="button"
                        onClick={() => setShipKind(shipKind === k.key ? null : k.key)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-center transition-all ${shipKind === k.key ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-hover'}`}
                      >
                        <span className={`text-[11px] font-semibold ${shipKind === k.key ? 'text-accent' : 'text-secondary'}`}>{k.key}</span>
                        <span className="ml-1 text-[9px] text-muted">{k.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stream */}
        <div className="p-5">
          <motion.div initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.07 } } }} className="space-y-2.5">
            {todaysEvents.length === 0 && (
              <p className="py-2 text-sm text-muted">Nothing logged yet. Push something — the log remembers everything.</p>
            )}
            {todaysEvents.slice(0, 10).map((e, i) => (
              <motion.div
                key={e.id}
                variants={{ initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 } }}
                className="flex items-center gap-3"
              >
                <Checkmark delay={i * 0.07} />
                <span className="min-w-0 flex-1 truncate text-sm text-primary">{e.title}</span>
                <CategoryPill category={e.category} />
                <span className="hidden font-mono text-[10px] text-muted sm:block">{SOURCE_LABEL[e.source]}</span>
              </motion.div>
            ))}
            {todaysEvents.length > 10 && (
              <button onClick={() => navigate('/app/timeline')} className="text-xs text-accent hover:underline">
                + {todaysEvents.length - 10} more in the timeline →
              </button>
            )}
          </motion.div>
        </div>

        {/* Evening chapter — same log, same card, the day's last entry */}
        <div className="px-5 pb-5">
          <div className="flex flex-col items-center py-4">
            <div className="flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-line to-line" />
              <DayCloseSeal done={!!existingLog} />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-line to-line" />
            </div>
            <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {existingLog ? <>day sealed <span className="text-success">✓</span></> : 'close out the day'}
            </span>
          </div>
          <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted">
                    Two minutes, honest answers. Future-you reads this when the motivation dips — write for them.
                  </p>
                  <Field label={prompts.built} value={built} onChange={setBuilt} placeholder="Even 'fixed one CSS bug' counts. Small ships stack." />
                  <Field label={prompts.blocked} value={blocked} onChange={setBlocked} placeholder="Name the wall. Tomorrow it's smaller." />
                  <Field label={prompts.learned} value={learned} onChange={setLearned} placeholder="The lesson you'd want back in a month." />
                  <div className="flex flex-col gap-5">
                    <div>
                      <div className="mb-0.5 text-xs font-medium text-secondary">Energy tank</div>
                      <div className="mb-2 text-[11px] text-muted">Drag the tank to how much fuel was left when you stopped. It shapes tomorrow's pace — and your analytics.</div>
                      <EnergyTank value={energy} onChange={setEnergy} />
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-secondary">How did the day fight?</div>
                      <div className="flex flex-wrap gap-1.5">
                        {MOODS.map(m => (
                          <button key={m.key} onClick={() => setMood(m.key)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${mood === m.key ? 'border-accent bg-accent/20 text-primary' : 'border-line text-muted hover:border-line-hover'}`}>
                            <span>{m.emoji}</span> {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="relative flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={saveReflection}
                      className="sheen rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                    >
                      {existingLog ? 'Update the log' : 'Close out the day · +25 XP'}
                    </motion.button>
                    <AnimatePresence>
                      {sealedToast && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-[13px] font-semibold text-success"
                        >
                          <Checkmark /> {sealedToast}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {xpFloat && (
                        <motion.span
                          initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} exit={{ opacity: 0 }}
                          transition={{ duration: 1.5 }}
                          className="absolute left-16 top-0 font-mono text-sm font-bold text-accent"
                        >
                          +25 XP
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
          </div>
        </div>

        {/* XP footer — the score, part of the same system */}
        <div className="border-t border-line bg-white/[0.015] px-5 py-4">
          <XPBar into={level.into} needed={level.needed} level={level.level} />
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
            <span>Lv {level.level} · {level.name}</span>
            <span>Lifetime: {profile.builderScore.toLocaleString()} XP · {profile.totalShips.toLocaleString()} ships</span>
          </div>
        </div>
      </GlassCard>

      {/* Turn today's log into a post — the whole point of capturing it */}
      <AnimatePresence>
        {todaysEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="sheen mt-4 rounded-2xl border border-accent/40 bg-accent/[0.08] p-4"
          >
            <button type="button" onClick={postToday} className="flex w-full items-center gap-3 text-left">
              <span className="shrink-0"><AICore size={26} color="#a5b4fc" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-primary">Turn today's {todaysEvents.length} {todaysEvents.length === 1 ? 'ship' : 'ships'} into a post</div>
                <div className="text-xs text-secondary">
                  The AI reads exactly what you shipped today — {[...new Set(todaysEvents.map(e => CATEGORY_META[e.category].label.toLowerCase()))].slice(0, 3).join(', ')} — and writes the story behind it.
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Write it →</span>
            </button>
            {/* Repo focus — talk about ONE project, or everything */}
            {todaysRepos.length > 0 && (
              <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-white/5 pt-3">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">Focus</span>
                <button
                  type="button" onClick={() => setFocusRepo(null)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${focusRepo === null ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}
                >
                  Everything
                </button>
                {todaysRepos.map(r => (
                  <button
                    key={r} type="button" onClick={() => setFocusRepo(focusRepo === r ? null : r)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] ${focusRepo === r ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick actions */}
      <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1">
        {[
          { label: 'Generate Tweet', icon: Sparkles, to: '/app/write' },
          { label: 'Write LinkedIn Post', icon: PenLine, to: '/app/write' },
          { label: 'View This Week', icon: CalendarRange, to: '/app/week' },
          { label: 'Search Memory', icon: Search, to: '/app/timeline' },
        ].map(a => (
          <motion.button
            key={a.label}
            whileTap={{ scale: 0.97 }}
            whileHover={{ borderColor: 'rgba(99,102,241,0.4)' }}
            onClick={() => navigate(a.to)}
            className="glass flex shrink-0 items-center gap-2 !rounded-full px-4 py-2.5 text-[13px] font-medium text-secondary"
          >
            <a.icon size={14} className="text-accent" /> {a.label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {addOpen && <AddEventModal onClose={() => { setAddOpen(false); setParams({}) }} />}
      </AnimatePresence>
    </Page>
  )
}

// Animated circular streak ring with the flame at its heart
function StreakRing({ days }: { days: number }) {
  const pct = Math.min(1, (days % 30) / 30 || 1)
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-line bg-white/[0.03] py-1 pl-1 pr-3.5">
      <div className="relative h-9 w-9">
        <svg viewBox="0 0 38 38" className="h-full w-full -rotate-90">
          <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
          <motion.circle
            cx="19" cy="19" r={r} fill="none" stroke="url(#streakGrad)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct) }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          />
          <defs>
            <linearGradient id="streakGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f59e0b" /><stop offset="60%" stopColor="#ef4444" /><stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <motion.span
          className="absolute inset-0 flex items-center justify-center text-sm"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          🔥
        </motion.span>
      </div>
      <div>
        <div className="font-mono text-sm font-bold leading-none text-primary">{days} days</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">streak</div>
      </div>
    </div>
  )
}

// ── Energy tank: a liquid gauge you DRAG — the day's fuel, made physical ──
// Pointer events (not mouse) so it feels native on phones; keyboard arrows
// and the labels underneath still work for accessibility and quick taps.
function EnergyTank({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const t = TANK[value - 1]
  const pct = (value / 5) * 100

  const setFromX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const rel = (clientX - r.left) / r.width
    onChange(Math.min(5, Math.max(1, Math.ceil(rel * 5))))
  }

  return (
    <div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Energy left in the tank"
        aria-valuemin={1} aria-valuemax={5} aria-valuenow={value} aria-valuetext={t.label}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, value - 1)) }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, value + 1)) }
        }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); setFromX(e.clientX) }}
        onPointerMove={e => { if (dragging) setFromX(e.clientX) }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className={`relative h-14 touch-none select-none overflow-hidden rounded-2xl border bg-white/[0.02] outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          borderColor: dragging ? `${t.color}66` : 'var(--edge)',
          boxShadow: dragging ? `0 0 28px ${t.color}33, inset 0 1px 0 rgba(255,255,255,0.06)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* segment ticks */}
        {[1, 2, 3, 4].map(i => (
          <span key={i} className="absolute inset-y-2.5 z-10 w-px bg-white/10" style={{ left: `${i * 20}%` }} />
        ))}
        {/* liquid */}
        <motion.div
          className="absolute inset-y-0 left-0"
          animate={{ width: `${pct}%` }}
          transition={dragging ? { type: 'spring', stiffness: 900, damping: 50 } : { type: 'spring', stiffness: 230, damping: 18 }}
        >
          <div className="tank-liquid" style={{ background: `linear-gradient(90deg, ${t.color}26, ${t.color}59 55%, ${t.color}a6)` }} />
          {/* glowing surface line at the liquid's edge */}
          <div className="absolute inset-y-1.5 right-0 w-[3px] rounded-full" style={{ background: t.color, filter: `drop-shadow(0 0 8px ${t.color})` }} />
          {/* bubbles */}
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="tank-bubble" style={{ left: `${10 + i * 19}%`, animationDelay: `${i * 0.55}s`, animationDuration: `${2 + (i % 3) * 0.5}s` }} />
          ))}
          {/* knob riding the surface */}
          <motion.div
            className="absolute right-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30"
            animate={{ scale: dragging ? 1.2 : 1, rotate: dragging ? [0, -8, 8, 0] : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            style={{ background: `radial-gradient(circle at 35% 30%, ${t.color}, ${t.color}88)`, boxShadow: `0 0 20px ${t.color}aa, 0 4px 12px rgba(0,0,0,0.45)` }}
          >
            <Zap size={15} className="text-white" fill="white" />
          </motion.div>
        </motion.div>
        {/* level word floats in the empty side of the tank */}
        <AnimatePresence mode="wait">
          <motion.span
            key={t.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${value >= 4 ? 'left-3.5' : 'right-3.5'}`}
            style={{ color: t.color, textShadow: `0 0 12px ${t.color}66` }}
          >
            {t.label}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* tap targets under each segment */}
      <div className="mt-1.5 flex">
        {TANK.map(lv => (
          <button
            key={lv.n} type="button" onClick={() => onChange(lv.n)}
            className={`flex-1 text-center text-[9.5px] font-medium uppercase tracking-wide transition-colors ${value === lv.n ? 'text-primary' : 'text-muted hover:text-secondary'}`}
          >
            {lv.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="mt-1 text-center text-[11px] text-secondary"
        >
          <span className="font-semibold" style={{ color: t.color }}>{t.label}</span> — {t.desc}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── The day-close seal: a living moon that becomes a green medal ──
function DayCloseSeal({ done }: { done: boolean }) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: done ? 'radial-gradient(closest-side, rgba(34,197,94,0.4), transparent)' : 'radial-gradient(closest-side, rgba(139,92,246,0.45), transparent)' }}
        animate={{ scale: [1, 1.45, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {done && (
        <>
          <motion.span className="absolute inset-0 rounded-full border-2 border-success/60"
            animate={{ scale: [1, 2], opacity: [0.7, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />
          <motion.span className="absolute inset-0 rounded-full border border-success/40"
            animate={{ scale: [1, 2.6], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }} />
        </>
      )}
      <AnimatePresence mode="wait">
        {done ? (
          <motion.svg key="done" viewBox="0 0 24 24" className="relative h-7 w-7"
            initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}>
            <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.5" />
            <motion.path d="M7.5 12.5l3 3L16.5 9" stroke="#22c55e" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.45 }} />
          </motion.svg>
        ) : (
          <motion.div key="moon" className="relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -2.5, 0], rotate: [-6, 6, -6] }}
            exit={{ scale: 0 }}
            transition={{
              y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
              scale: { type: 'spring', stiffness: 300, damping: 18 },
            }}>
            <svg viewBox="0 0 24 24" className="h-7 w-7">
              <defs>
                <linearGradient id="sealMoon" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c7d2fe" /><stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="url(#sealMoon)" style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.8))' }} />
            </svg>
            {[{ x: -8, y: -3, d: 0 }, { x: 25, y: 3, d: 0.9 }, { x: 20, y: -9, d: 1.7 }].map((s, i) => (
              <motion.span key={i} className="absolute text-[7px] leading-none text-indigo-200"
                style={{ left: s.x, top: s.y }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.25, 0.7] }}
                transition={{ duration: 2.1, repeat: Infinity, delay: s.d }}>
                ✦
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-secondary">{label}</div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm placeholder:text-muted/70"
      />
    </div>
  )
}
