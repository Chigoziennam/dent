import { motion } from 'framer-motion'
import { useShipLog } from '../lib/store'
import { ACHIEVEMENTS, RARITY_META } from '../lib/achievements'
import { Page, stagger, CountUp } from '../components/ui'
import type { Rarity } from '../lib/types'

// Medal art per rarity — bronze ring → gold laurel
const MEDAL: Record<Rarity, { ring: string; ribbon: string }> = {
  common: { ring: '#8888a0', ribbon: '#555566' },
  rare: { ring: '#60a5fa', ribbon: '#1d4ed8' },
  epic: { ring: '#a78bfa', ribbon: '#6d28d9' },
  legendary: { ring: '#fcd34d', ribbon: '#b45309' },
}

function Medal({ rarity, icon, earned }: { rarity: Rarity; icon: string; earned: boolean }) {
  const m = MEDAL[rarity]
  return (
    <div className={`relative mx-auto h-20 w-16 ${earned ? '' : 'opacity-40 grayscale'}`}>
      <svg viewBox="0 0 64 80" className="h-full w-full">
        {/* ribbon */}
        <path d="M20 0 L32 20 L44 0 L38 0 L32 10 L26 0 Z" fill={m.ribbon} />
        <path d="M24 0 L32 14 L40 0" fill="none" stroke={m.ring} strokeWidth="1" opacity="0.5" />
        {/* medal disc */}
        <circle cx="32" cy="44" r="22" fill="#12121a" stroke={m.ring} strokeWidth="3" />
        <circle cx="32" cy="44" r="17" fill="none" stroke={m.ring} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        {earned && (
          <circle cx="32" cy="44" r="22" fill="none" stroke={m.ring} strokeWidth="1" opacity="0.5">
            <animate attributeName="r" values="22;27" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <span className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 text-xl">{icon}</span>
    </div>
  )
}

export default function Achievements() {
  const { unlocked, events, dailyLogs, content, profile } = useShipLog()
  const count = Object.keys(unlocked).length
  const earnedXP = ACHIEVEMENTS.filter(a => unlocked[a.code]).reduce((s, a) => s + a.xp, 0)

  // Live progress toward locked achievements — same metrics the unlock engine uses
  const metrics: Record<string, number> = {
    total_events: events.length,
    total_commits: events.filter(e => e.category === 'commit').length,
    streak_days: profile.streakCurrent,
    daily_logs: dailyLogs.length,
    content_pieces: content.length,
    revenue_events: events.filter(e => e.category === 'revenue' || e.category === 'customer').length,
    level: Math.floor(profile.builderScore / 500) + 1,
  }

  const tiers: Rarity[] = ['legendary', 'epic', 'rare', 'common']

  return (
    <Page>
      {/* Hall of fame header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass noise relative overflow-hidden !rounded-3xl p-6 text-center md:p-8"
      >
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-warning">Hall of Fame</div>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            <CountUp value={count} className="text-warning" /> <span className="text-muted">/</span> {ACHIEVEMENTS.length}
          </h1>
          <p className="mt-1 text-sm text-secondary">medals earned · <span className="font-mono text-warning">+{earnedXP.toLocaleString()} XP</span> from achievements alone</p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #fcd34d)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {tiers.map(tier => {
        const list = ACHIEVEMENTS.filter(a => a.rarity === tier)
        if (list.length === 0) return null
        const meta = RARITY_META[tier]
        return (
          <div key={tier} className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: meta.color }}>{meta.label}</span>
              <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${meta.color}44, transparent)` }} />
              <span className="font-mono text-[10px] text-muted">{list.filter(a => unlocked[a.code]).length}/{list.length}</span>
            </div>
            <motion.div initial="initial" animate="animate" variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {list.map(a => {
                const date = unlocked[a.code]
                const progress = Math.min(1, (metrics[a.metric] ?? 0) / a.threshold)
                return (
                  <motion.div
                    key={a.code}
                    variants={{
                      initial: { opacity: 0, scale: date ? 0 : 0.92 },
                      animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } },
                    }}
                    whileHover={{ y: -3 }}
                    className="glass relative overflow-hidden p-4 text-center"
                    style={date ? { borderColor: `${meta.color}55`, boxShadow: `0 0 32px ${meta.glow}, 0 8px 32px rgba(0,0,0,0.4)` } : undefined}
                  >
                    {date && tier === 'legendary' && <div className="sheen absolute inset-0" />}
                    <Medal rarity={a.rarity} icon={a.icon} earned={Boolean(date)} />
                    <div className="mt-1 font-display text-[13px] font-bold text-primary">{a.name}</div>
                    <div className={`mt-0.5 min-h-[28px] text-[11px] leading-snug text-secondary ${date ? '' : 'blur-[2px]'}`}>{a.description}</div>
                    {date ? (
                      <div className="mt-2 font-mono text-[10px] text-muted">Unlocked {date} · <span style={{ color: meta.color }}>+{a.xp} XP</span></div>
                    ) : (
                      <div className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: meta.color, opacity: 0.7 }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${progress * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[9.5px] text-muted">
                          {Math.min(metrics[a.metric] ?? 0, a.threshold).toLocaleString()} / {a.threshold.toLocaleString()} · +{a.xp} XP waiting
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        )
      })}
    </Page>
  )
}
