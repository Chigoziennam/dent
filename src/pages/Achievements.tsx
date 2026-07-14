import { motion } from 'framer-motion'
import { useShipLog } from '../lib/store'
import { ACHIEVEMENTS, RARITY_META } from '../lib/achievements'
import { Page, stagger } from '../components/ui'

export default function Achievements() {
  const unlocked = useShipLog(s => s.unlocked)
  const count = Object.keys(unlocked).length

  return (
    <Page>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🏆 Achievements</h1>
          <p className="mt-1 text-sm text-secondary">{count} of {ACHIEVEMENTS.length} unlocked</p>
        </div>
        <div className="font-mono text-xs text-muted">{Math.round((count / ACHIEVEMENTS.length) * 100)}%</div>
      </div>

      <motion.div
        initial="initial" animate="animate" variants={stagger}
        className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      >
        {ACHIEVEMENTS.map(a => {
          const date = unlocked[a.code]
          const meta = RARITY_META[a.rarity]
          return (
            <motion.div
              key={a.code}
              variants={{
                initial: { opacity: 0, scale: date ? 0 : 0.9 },
                animate: { opacity: date ? 1 : 0.4, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } },
              }}
              className="glass relative p-4 text-center"
              style={date ? { boxShadow: `0 0 32px ${meta.glow}, 0 8px 32px rgba(0,0,0,0.4)` } : undefined}
            >
              <div className={`text-3xl ${date ? '' : 'grayscale opacity-50'}`}>{a.icon}</div>
              <div className="mt-2 text-[13px] font-semibold text-primary">{a.name}</div>
              <div className={`mt-0.5 text-[11px] leading-snug text-secondary ${date ? '' : 'blur-[3px]'}`}>{a.description}</div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</div>
              <div className="mt-1 font-mono text-[10px] text-muted">{date ? `Unlocked ${date} · +${a.xp} XP` : '??? · locked'}</div>
            </motion.div>
          )
        })}
      </motion.div>
    </Page>
  )
}
