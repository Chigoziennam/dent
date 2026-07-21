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

// Full deep-space scene: parallax starfields, nebula aurora,
// shooting stars, a rolling synthwave grid and a planet rim.
// Use on landing-class pages; Orbs stays as the lightweight variant.
export function SpaceBackdrop({ withFloor = true }: { withFloor?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="aurora" />
      <div className="star-layer star-layer-1" />
      <div className="star-layer star-layer-2" />
      <div className="star-layer star-layer-3" />
      <span className="shooting-star" style={{ top: '12%', right: '-10%', animationDelay: '1s' }} />
      <span className="shooting-star" style={{ top: '30%', right: '-16%', animationDelay: '5.5s', animationDuration: '11s' }} />
      {withFloor && <>
        <div className="planet" />
        <div className="grid-floor" />
      </>}
    </div>
  )
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

// ── Animated avatar: spinning conic aura + breathing + presence pulse ──
// The "extreme UI" profile treatment — used in the sidebar, settings and
// the public profile so the builder always looks alive.
export function AnimatedAvatar({ src, fallback, hue = 245, size = 40, pulse = true }: {
  src?: string; fallback: string; hue?: number; size?: number; pulse?: boolean
}) {
  return (
    <div className="avatar-ring relative shrink-0 rounded-full" style={{ width: size, height: size }}>
      <motion.div
        className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 70% 55% / 0.5), hsl(${hue + 60} 70% 55% / 0.35))`,
          border: '2px solid var(--bg)',
          fontSize: size * 0.4,
        }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {src
          ? <img src={src} alt="" className="h-full w-full object-cover" />
          : <span className="font-bold text-white" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>{fallback}</span>}
      </motion.div>
      {pulse && (
        <span
          className="absolute bottom-0 right-0 z-20 rounded-full bg-success"
          style={{
            width: Math.max(8, size * 0.22), height: Math.max(8, size * 0.22),
            border: '2px solid var(--bg)',
            boxShadow: '0 0 8px rgba(34,197,94,0.9)',
          }}
        />
      )}
    </div>
  )
}

// ── AI Core: the co-pilot's face — a living reactor, not an emoji ──
// Rotating orbit ring + counter-rotating dashes + pulsing plasma heart.
export function AICore({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  // A small piece of deep space rather than a glowing dot: a nebula core with
  // a hot centre, three orbits sitting at different inclinations so the thing
  // reads as volumetric, satellites riding two of them, and a sparse star
  // field that drifts. Everything is SVG + transforms, so it composites on
  // the GPU and costs nothing to keep running.
  const uid = 'ai'
  return (
    <motion.svg viewBox="0 0 48 48" width={size} height={size} aria-hidden initial={false}>
      <defs>
        {/* Hot white centre bleeding through indigo into deep violet. */}
        <radialGradient id={`${uid}Core`} cx="40%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#dbeafe" />
          <stop offset="58%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>
        {/* The haze the core sits in — what makes it feel like depth. */}
        <radialGradient id={`${uid}Neb`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}Ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.05" />
          <stop offset="45%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Nebula haze, breathing out of phase with the core so it never pulses
          as one flat unit. */}
      <motion.circle
        cx="24" cy="24" r="23" fill={`url(#${uid}Neb)`}
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [1, 1.06, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '24px', originY: '24px' }}
      />

      {/* Star field — a few points at fixed spots, twinkling on their own
          clocks so the pattern never looks like a loop. */}
      {[[7, 11, 0.9], [40, 15, 0.7], [12, 38, 0.75], [38, 36, 0.85], [24, 5, 0.6], [5, 25, 0.65]].map(([cx, cy, r], i) => (
        <motion.circle
          key={i} cx={cx} cy={cy} r={r} fill="#e0e7ff"
          animate={{ opacity: [0.15, 0.85, 0.15] }}
          transition={{ duration: 2.4 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.45 }}
        />
      ))}

      {/* Three inclined orbits. Different tilts + directions is what sells
          three dimensions in a 48px box. */}
      <motion.g
        animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '24px', originY: '24px' }}
      >
        <ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke={`url(#${uid}Ring)`} strokeWidth="1.4" transform="rotate(-18 24 24)" />
        <circle cx="45" cy="24" r="2.2" fill="#c7d2fe" transform="rotate(-18 24 24)"
          style={{ filter: 'drop-shadow(0 0 4px rgba(199,210,254,0.95))' }} />
      </motion.g>

      <motion.g
        animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '24px', originY: '24px' }}
      >
        <ellipse cx="24" cy="24" rx="17" ry="6.5" fill="none" stroke={`url(#${uid}Ring)`} strokeWidth="1.2" transform="rotate(52 24 24)" />
        <circle cx="41" cy="24" r="1.7" fill="#a5b4fc" transform="rotate(52 24 24)"
          style={{ filter: 'drop-shadow(0 0 3px rgba(165,180,252,0.9))' }} />
      </motion.g>

      {/* Dashed inner ring — the "scanning" read. */}
      <motion.circle
        cx="24" cy="24" r="12.5" fill="none" stroke={color} strokeOpacity="0.45"
        strokeWidth="1.1" strokeDasharray="3 6" strokeLinecap="round"
        animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '24px', originY: '24px' }}
      />

      {/* Corona, then the core itself. */}
      <motion.circle
        cx="24" cy="24" r="9.5" fill="none" stroke="#a5b4fc" strokeOpacity="0.35" strokeWidth="0.8"
        animate={{ r: [8.5, 11.5, 8.5], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.circle
        cx="24" cy="24" r="7" fill={`url(#${uid}Core)`}
        animate={{ scale: [1, 1.13, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '24px', originY: '24px', filter: 'drop-shadow(0 0 7px rgba(147,161,252,0.95))' }}
      />
      {/* Offset specular highlight — reads as a lit sphere, not a flat disc. */}
      <motion.circle
        cx="21.6" cy="21.6" r="2" fill="#ffffff"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
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

// A ship in steady orbit around the builder's Earth — the app is a cockpit in
// low orbit. Pure CSS motion via offset-path (the .orbit-ship keyframe in
// index.css), so it costs nothing and honours prefers-reduced-motion.
export function EarthOrbit({ size = 132 }: { size?: number }) {
  const c = size / 2
  const rx = size * 0.46, ry = size * 0.185
  // A flattened ellipse reads as a tilted orbital plane in 2D.
  const path = `M ${c - rx},${c} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 ${-rx * 2},0`
  return (
    <div className="relative shrink-0 select-none" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full overflow-visible">
        <path d={path} fill="none" stroke="rgba(150,180,255,0.30)" strokeWidth="1" strokeDasharray="2 5" />
      </svg>
      <img
        src="/space/earth-orbit.jpg" alt="" loading="lazy"
        className="absolute left-1/2 top-1/2 rounded-full object-cover"
        style={{ width: size * 0.62, height: size * 0.62, transform: 'translate(-50%,-50%)', boxShadow: '0 0 26px rgba(70,130,255,0.5), inset -7px -7px 20px rgba(0,0,0,0.55)' }}
      />
      <div
        className="orbit-ship absolute left-0 top-0 text-base"
        style={{ offsetPath: `path("${path}")`, offsetRotate: 'auto', animation: 'orbit-run 12s linear infinite', filter: 'drop-shadow(0 0 4px rgba(150,180,255,0.85))' }}
      >
        🛰️
      </div>
    </div>
  )
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
