import { motion, useMotionValue, useSpring, useTransform, useInView } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { CATEGORY_META, type EventCategory } from '../lib/types'

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' as const },
}

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
}

export const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div {...pageTransition} className={`mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8 ${className}`}>
      {children}
    </motion.div>
  )
}

export function GlassCard({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <motion.div
      variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
      whileHover={hover ? { y: -2, borderColor: 'rgba(255,255,255,0.12)' } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`glass p-5 ${className}`}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({ value, className = '', prefix = '', suffix = '' }: { value: number; className?: string; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 2000, bounce: 0 })
  const rounded = useTransform(spring, v => `${prefix}${Math.round(v).toLocaleString()}${suffix}`)
  useEffect(() => { if (inView) mv.set(value) }, [inView, value, mv])
  return <motion.span ref={ref} className={`font-mono tabular-nums ${className}`}>{rounded}</motion.span>
}

// Living backdrop: drifting aurora + twinkling stars.
// Deterministic star placement so it never shifts between renders.
export function Orbs() {
  const stars = Array.from({ length: 28 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53 + 11) % 100}%`,
    delay: `${(i % 7) * 0.45}s`,
    scale: 0.6 + ((i * 13) % 10) / 10,
  }))
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="aurora" />
      {stars.map((s, i) => (
        <span key={i} className="star" style={{ left: s.left, top: s.top, animationDelay: s.delay, transform: `scale(${s.scale})` }} />
      ))}
    </div>
  )
}

export function CategoryPill({ category }: { category: EventCategory }) {
  const meta = CATEGORY_META[category]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  )
}

export function StreakBadge({ days, size = 'md' }: { days: number; size?: 'sm' | 'md' }) {
  return (
    <div className={`streak-gradient inline-flex items-center gap-1.5 rounded-full font-semibold text-white shadow-lg ${size === 'md' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'}`}>
      <motion.span
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-block"
      >
        🔥
      </motion.span>
      {days} Day Streak
    </div>
  )
}

export function XPBar({ into, needed, level }: { into: number; needed: number; level: number }) {
  const pct = Math.min(100, Math.round((into / needed) * 100))
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="shimmer h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-xs text-muted">
        <span>Level {level} → {level + 1}</span>
        <span>{into} / {needed} XP</span>
      </div>
    </div>
  )
}

export function Checkmark({ delay = 0 }: { delay?: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <motion.circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2" strokeOpacity="0.3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay }} />
      <motion.path d="M7 12.5l3.2 3.2L17 9" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: delay + 0.2 }} />
    </svg>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{children}</h2>
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="180" height="180" rx="40" fill="rgba(255,255,255,0.04)" />
      <path d="M50 118 L90 50 L130 118 L112 118 L90 80 L68 118 Z" fill="url(#lg)" />
      <rect x="58" y="128" width="64" height="8" rx="4" fill="#6366f1" opacity="0.85" />
    </svg>
  )
}
