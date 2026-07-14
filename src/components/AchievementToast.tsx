import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShipLog } from '../lib/store'
import { ACHIEVEMENTS, RARITY_META } from '../lib/achievements'

export function AchievementToast() {
  const justUnlocked = useShipLog(s => s.justUnlocked)
  const clear = useShipLog(s => s.clearUnlockToast)
  const def = ACHIEVEMENTS.find(a => a.code === justUnlocked)

  useEffect(() => {
    if (justUnlocked) {
      const t = setTimeout(clear, 4200)
      return () => clearTimeout(t)
    }
  }, [justUnlocked, clear])

  return (
    <AnimatePresence>
      {def && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={clear}
        >
          {/* Particle burst — tasteful accent dots */}
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * Math.PI * 2
            return (
              <motion.div
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{ background: i % 3 === 0 ? '#ec4899' : '#6366f1' }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * (120 + (i % 4) * 40),
                  y: Math.sin(angle) * (120 + (i % 4) * 40),
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
              />
            )
          })}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="glass-strong mx-6 max-w-sm p-8 text-center"
            style={{ boxShadow: `0 0 80px ${RARITY_META[def.rarity].glow}, 0 24px 64px rgba(0,0,0,0.6)` }}
          >
            <motion.div
              className="text-5xl"
              animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {def.icon}
            </motion.div>
            <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: RARITY_META[def.rarity].color }}>
              {RARITY_META[def.rarity].label} · Achievement Unlocked
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight">{def.name}</div>
            <div className="mt-1 text-sm text-secondary">{def.description}</div>
            <div className="mt-3 font-mono text-sm font-semibold text-accent">+{def.xp} XP</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
