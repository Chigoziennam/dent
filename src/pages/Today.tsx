import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { Plus, Sparkles, PenLine, Search, CalendarRange, Flame, Hammer } from 'lucide-react'
import { useShipLog, todayStr } from '../lib/store'
import { SOURCE_LABEL, levelForXP, type Mood } from '../lib/types'
import { Page, GlassCard, XPBar, Checkmark, SectionTitle, CategoryPill, stagger } from '../components/ui'
import { AddEventModal } from '../components/AddEventModal'
import { Mascot } from '../components/Mascot'

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

export default function Today() {
  const { profile, events, dailyLogs, saveDailyLog } = useShipLog()
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

  const saveReflection = () => {
    saveDailyLog({ logDate: today, whatIBuilt: built, whatBlockedMe: blocked, whatILearned: learned, energyLevel: energy, mood })
    setXpFloat(true)
    setTimeout(() => setXpFloat(false), 1600)
  }

  return (
    <Page>
      {/* ── Hero: greeting + streak ring + mascot ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}
        className="glass relative overflow-hidden !rounded-3xl p-6 md:p-8"
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
                {/* Count bubble on hover */}
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
        <motion.span
          className="mt-0.5 text-lg"
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
        >
          🤖
        </motion.span>
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
            <button onClick={() => setAddOpen(true)} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent">
              + Ship
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial="initial" animate="animate" variants={stagger} className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Today's progress */}
        <GlassCard className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Captured Today</SectionTitle>
              <p className="-mt-2 mb-3 text-[11px] text-muted">Auto-captured from your tools + anything you log by hand</p>
            </div>
            <span className="font-mono text-xs text-muted">{todaysEvents.length} ships</span>
          </div>
          <motion.div initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.08 } } }} className="space-y-2.5">
            {todaysEvents.length === 0 && (
              <p className="py-4 text-sm text-muted">Nothing logged yet today. Ship something — or log what you already shipped.</p>
            )}
            {todaysEvents.slice(0, 8).map((e, i) => (
              <motion.div
                key={e.id}
                variants={{ initial: { opacity: 0, x: -12 }, animate: { opacity: 1, x: 0 } }}
                className="flex items-center gap-3"
              >
                <Checkmark delay={i * 0.08} />
                <span className="min-w-0 flex-1 truncate text-sm text-primary">{e.title}</span>
                <CategoryPill category={e.category} />
                <span className="hidden font-mono text-[10px] text-muted sm:block">{SOURCE_LABEL[e.source]}</span>
              </motion.div>
            ))}
          </motion.div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setAddOpen(true)}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent"
          >
            <Plus size={14} /> Add Event
          </motion.button>
        </GlassCard>

        {/* XP card */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle>Builder Score</SectionTitle>
          <div className="font-mono text-3xl font-bold text-primary">+{xpToday} <span className="text-base text-accent">XP today</span></div>
          <div className="mt-1 text-xs text-secondary">Level {level.level} · {level.name}</div>
          <div className="mt-4"><XPBar into={level.into} needed={level.needed} level={level.level} /></div>
          <div className="mt-4 border-t border-line pt-3 font-mono text-xs text-muted">
            Lifetime: {profile.builderScore.toLocaleString()} XP · {profile.totalShips.toLocaleString()} ships
          </div>
        </GlassCard>
      </motion.div>

      {/* ── The Builder's Logbook (evening reflection) ── */}
      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <button onClick={() => setReflectOpen(o => !o)} className="flex w-full items-center justify-between p-5 text-left">
          <div className="min-w-0">
            <span className="text-[15px] font-semibold">The Builder's Logbook</span>
            {existingLog
              ? <span className="ml-2.5 text-xs text-success">logged ✓</span>
              : <span className="ml-2.5 text-xs text-muted">{hour >= 18 ? 'the day deserves a debrief' : 'opens properly after 6pm — early entries welcome'}</span>}
          </div>
          <motion.span animate={{ rotate: reflectOpen ? 180 : 0 }} className="text-muted">▾</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {reflectOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="space-y-3 px-5 pb-5">
                <p className="text-xs leading-relaxed text-muted">
                  Two minutes, honest answers. Future-you reads this when the motivation dips — write for them.
                </p>
                <Field label={prompts.built} value={built} onChange={setBuilt} placeholder="Even 'fixed one CSS bug' counts. Small ships stack." />
                <Field label={prompts.blocked} value={blocked} onChange={setBlocked} placeholder="Name the wall. Tomorrow it's smaller." />
                <Field label={prompts.learned} value={learned} onChange={setLearned} placeholder="The lesson you'd want back in a month." />
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="mb-0.5 text-xs font-medium text-secondary">Energy tank</div>
                    <div className="mb-2 text-[11px] text-muted">How much fuel was left in you when you stopped? It shapes tomorrow's pace — and your analytics.</div>
                    <div className="flex gap-1.5">
                      {TANK.map(t => (
                        <button
                          key={t.n}
                          onClick={() => setEnergy(t.n)}
                          className="group flex-1 text-left"
                        >
                          <div
                            className={`h-8 rounded-lg border transition-all ${energy >= t.n ? 'border-transparent' : 'border-line bg-white/[0.02] group-hover:border-line-hover'}`}
                            style={energy >= t.n ? { background: `linear-gradient(135deg, ${TANK[energy - 1].color}cc, ${TANK[energy - 1].color}66)`, boxShadow: `0 0 14px ${TANK[energy - 1].color}44` } : undefined}
                          />
                          <div className={`mt-1 text-center text-[9.5px] font-medium uppercase tracking-wide ${energy === t.n ? 'text-primary' : 'text-muted'}`}>{t.label}</div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 text-center text-[11px] text-secondary">
                      <span className="font-semibold" style={{ color: TANK[energy - 1].color }}>{TANK[energy - 1].label}</span> — {TANK[energy - 1].desc}
                    </div>
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
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={saveReflection}
                    className="sheen rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                  >
                    {existingLog ? 'Update the log' : 'Close out the day · +25 XP'}
                  </motion.button>
                  <AnimatePresence>
                    {xpFloat && (
                      <motion.span
                        initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} exit={{ opacity: 0 }}
                        transition={{ duration: 1.5 }}
                        className="absolute left-1/2 top-0 font-mono text-sm font-bold text-accent"
                      >
                        +25 XP
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

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
