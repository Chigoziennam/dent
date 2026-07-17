import { motion } from 'framer-motion'

// The Super Dent X companion: a parrot keeps you company by day,
// a night owl takes the late shift. Both perch on builder blocks.
export function Mascot({ size = 92 }: { size?: number }) {
  const hour = new Date().getHours()
  const night = hour >= 19 || hour < 6
  return night ? <Owl size={size} /> : <Parrot size={size} />
}

function Blocks() {
  return (
    <g>
      <rect x="28" y="96" width="30" height="18" rx="4" fill="#1a1a2e" stroke="rgba(99,102,241,0.35)" />
      <rect x="52" y="104" width="30" height="18" rx="4" fill="#12121a" stroke="rgba(255,255,255,0.1)" />
      <rect x="40" y="112" width="34" height="14" rx="4" fill="#1a1a2e" stroke="rgba(236,72,153,0.3)" />
      <text x="43" y="109" fontSize="8" fill="#6366f1" fontFamily="monospace">{'</>'}</text>
    </g>
  )
}

function Parrot({ size }: { size: number }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 110 130" fill="none"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="Super Dent X parrot companion"
    >
      <Blocks />
      {/* tail */}
      <motion.path
        d="M38 88 Q22 100 18 116 Q30 108 40 96 Z"
        fill="#f59e0b"
        animate={{ rotate: [0, -4, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '40px 90px' }}
      />
      {/* body */}
      <ellipse cx="55" cy="72" rx="24" ry="28" fill="#22c55e" />
      <ellipse cx="55" cy="80" rx="15" ry="17" fill="#a7f3d0" opacity="0.85" />
      {/* wing */}
      <motion.ellipse
        cx="70" cy="74" rx="10" ry="18" fill="#16a34a"
        animate={{ rotate: [0, 6, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '70px 60px' }}
      />
      {/* head */}
      <circle cx="52" cy="42" r="19" fill="#22c55e" />
      <circle cx="47" cy="30" r="7" fill="#ef4444" />
      <circle cx="56" cy="27" r="6" fill="#f59e0b" />
      {/* face patch + eye (blinks) */}
      <circle cx="45" cy="42" r="9" fill="#fefce8" />
      <motion.circle
        cx="45" cy="42" r="3.2" fill="#0a0a0f"
        animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] }}
        style={{ transformOrigin: '45px 42px' }}
      />
      {/* beak */}
      <path d="M32 44 Q24 47 30 52 Q35 55 39 50 Q36 45 32 44 Z" fill="#f59e0b" />
      {/* feet gripping the block */}
      <path d="M48 98 l-3 5 M52 98 l0 6 M60 98 l3 5" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
    </motion.svg>
  )
}

function Owl({ size }: { size: number }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 110 130" fill="none"
      animate={{ y: [0, -2.5, 0] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="Super Dent X night owl companion"
    >
      {/* moon */}
      <circle cx="90" cy="18" r="9" fill="#fcd34d" opacity="0.25" />
      <circle cx="86" cy="15" r="8" fill="#0a0a0f" />
      <Blocks />
      {/* body */}
      <ellipse cx="55" cy="70" rx="26" ry="30" fill="#4c1d95" />
      <ellipse cx="55" cy="78" rx="16" ry="19" fill="#a78bfa" opacity="0.5" />
      {/* chest feather chevrons */}
      <path d="M48 70 l7 5 l7 -5 M48 80 l7 5 l7 -5" stroke="#c4b5fd" strokeWidth="1.6" fill="none" opacity="0.7" />
      {/* ear tufts */}
      <path d="M36 32 L40 18 L48 30 Z" fill="#4c1d95" />
      <path d="M74 32 L70 18 L62 30 Z" fill="#4c1d95" />
      {/* head */}
      <circle cx="55" cy="42" r="21" fill="#5b21b6" />
      {/* big owl eyes (slow synchronized blink) */}
      <circle cx="47" cy="42" r="8.5" fill="#fef9c3" />
      <circle cx="63" cy="42" r="8.5" fill="#fef9c3" />
      <motion.g
        animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
        transition={{ duration: 5, repeat: Infinity, times: [0, 0.88, 0.93, 0.97, 1] }}
        style={{ transformOrigin: '55px 42px' }}
      >
        <circle cx="47" cy="42" r="4" fill="#0a0a0f" />
        <circle cx="63" cy="42" r="4" fill="#0a0a0f" />
        <circle cx="48.5" cy="40.5" r="1.3" fill="#fef9c3" />
        <circle cx="64.5" cy="40.5" r="1.3" fill="#fef9c3" />
      </motion.g>
      {/* beak */}
      <path d="M53 50 L55 56 L57 50 Z" fill="#f59e0b" />
      {/* wings folded */}
      <path d="M30 62 Q26 82 36 94 Q40 80 38 64 Z" fill="#3b0764" />
      <path d="M80 62 Q84 82 74 94 Q70 80 72 64 Z" fill="#3b0764" />
      {/* feet */}
      <path d="M48 99 l-3 5 M52 99 l0 6 M60 99 l3 5" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
    </motion.svg>
  )
}
