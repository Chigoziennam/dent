import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Plus, Sparkles, PenLine, Search, CalendarRange } from 'lucide-react'
import { useShipLog, todayStr } from '../lib/store'
import { SOURCE_LABEL, levelForXP, type Mood } from '../lib/types'
import { Page, GlassCard, StreakBadge, XPBar, Checkmark, SectionTitle, CategoryPill, stagger } from '../components/ui'
import { AddEventModal } from '../components/AddEventModal'

const MOODS: { key: Mood; emoji: string }[] = [
  { key: 'fire', emoji: '🔥' }, { key: 'good', emoji: '😊' }, { key: 'meh', emoji: '😐' },
  { key: 'tough', emoji: '😓' }, { key: 'burned_out', emoji: '🫠' },
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
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const xpToday = todaysEvents.length * 10 + (existingLog ? 25 : 0)

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
      {/* Greeting */}
      <motion.div initial="initial" animate="animate" variants={stagger} className="flex flex-wrap items-start justify-between gap-3">
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{greeting}, {profile.displayName} 👋</h1>
          <p className="mt-1 text-sm text-secondary">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </motion.div>
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}>
          <StreakBadge days={profile.streakCurrent} />
        </motion.div>
      </motion.div>

      <motion.div initial="initial" animate="animate" variants={stagger} className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Today's progress */}
        <GlassCard className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Today's Progress</SectionTitle>
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

      {/* Evening reflection */}
      <GlassCard className="mt-4 !p-0 overflow-hidden">
        <button onClick={() => setReflectOpen(o => !o)} className="flex w-full items-center justify-between p-5 text-left">
          <div>
            <span className="text-[15px] font-semibold">📝 Evening Reflection</span>
            {existingLog && <span className="ml-2.5 text-xs text-success">saved ✓</span>}
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
                <Field label="What did you build today?" value={built} onChange={setBuilt} />
                <Field label="What blocked you?" value={blocked} onChange={setBlocked} />
                <Field label="What did you learn?" value={learned} onChange={setLearned} />
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-secondary">Energy level</div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setEnergy(n)}
                          className={`h-9 w-9 rounded-lg border text-sm font-semibold transition-all ${energy === n ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted hover:border-line-hover'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-secondary">Mood</div>
                    <div className="flex gap-1.5">
                      {MOODS.map(m => (
                        <button key={m.key} onClick={() => setMood(m.key)}
                          className={`h-9 w-9 rounded-lg border text-lg transition-all ${mood === m.key ? 'border-accent bg-accent/20 scale-110' : 'border-line opacity-60 hover:opacity-100'}`}>
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={saveReflection}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                  >
                    {existingLog ? 'Update Reflection' : 'Save & Earn 25 XP'}
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-secondary">{label}</div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm placeholder:text-muted"
      />
    </div>
  )
}
