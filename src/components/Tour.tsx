import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Clock, Sparkles, PenLine, ScrollText, Plug, Trophy, ArrowRight, ArrowLeft } from 'lucide-react'
import { useDent } from '../lib/store'
import { AICore } from './ui'

// ── Guided tour — the "know your way around" pass big products do ──
// One card per surface, in the order a real day flows. Each card can jump
// straight to the page it describes. Runs once; replayable from Settings.
const STOPS = [
  {
    icon: Sun, to: '/app/today', title: 'Today — your cockpit',
    body: 'Log every ship the second it happens: commits, fixes, revenue, milestones. In the evening, close out the day — energy tank, mood, lessons. This page IS the habit.',
    color: '#f59e0b',
  },
  {
    icon: Clock, to: '/app/timeline', title: 'Timeline — your memory',
    body: 'Everything you ever logged, searchable. "When did I fix auth?" — the answer is always here. Nothing gets forgotten again.',
    color: '#06b6d4',
  },
  {
    icon: Sparkles, to: '/app/week', title: 'This Week — your story',
    body: 'Your week, gathered up and ready to become content. Pick the ships that matter and hand them to the writer.',
    color: '#8b5cf6',
  },
  {
    icon: PenLine, to: '/app/write', title: 'Write — your voice, amplified',
    body: 'The AI turns your real events into posts for X, LinkedIn and newsletters — real numbers, your tone, zero "exciting news!" energy.',
    color: '#ec4899',
  },
  {
    icon: ScrollText, to: '/app/changelog', title: 'Changelog — your public proof',
    body: 'Publish updates to your public page. Anyone with your link sees what you shipped — receipts for the journey.',
    color: '#22c55e',
  },
  {
    icon: Trophy, to: '/app/achievements', title: 'Achievements & Analytics',
    body: 'Streaks, XP, medals — and charts of your shipping rhythm. On the phone, find these under the More tab.',
    color: '#fcd34d',
  },
  {
    icon: Plug, to: '/app/integrations', title: 'Integrations & the Co-pilot',
    body: 'Connect GitHub so commits log themselves. And the glowing core at the bottom right? That is your co-pilot — it has read your whole log. Talk to it any time.',
    color: '#6366f1',
  },
]

export function Tour() {
  const updateProfile = useDent(s => s.updateProfile)
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const stop = STOPS[i]
  const done = () => updateProfile({ tourDone: true })
  const visit = () => { navigate(stop.to); done() }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 p-4 pb-28 backdrop-blur-sm md:items-center md:pb-4"
      onClick={done}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass-strong w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-2">
          <AICore size={20} color="#a5b4fc" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Quick tour · {i + 1}/{STOPS.length}</span>
          <button onClick={done} className="ml-auto text-[11px] text-muted hover:text-secondary">Skip</button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${stop.color}1f`, boxShadow: `0 0 22px ${stop.color}33` }}>
              <stop.icon size={20} style={{ color: stop.color }} />
            </div>
            <h3 className="mt-3 text-lg font-bold tracking-tight">{stop.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{stop.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* dots */}
        <div className="mt-4 flex gap-1.5">
          {STOPS.map((_, d) => (
            <button key={d} onClick={() => setI(d)} aria-label={`step ${d + 1}`}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: d <= i ? stop.color : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="rounded-xl border border-line p-2.5 text-secondary hover:border-line-hover">
              <ArrowLeft size={15} />
            </button>
          )}
          <button onClick={visit} className="rounded-xl border border-line px-3.5 py-2.5 text-xs font-medium text-secondary hover:border-line-hover hover:text-primary">
            Take me there
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => (i < STOPS.length - 1 ? setI(i + 1) : done())}
            className="sheen ml-auto flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]"
          >
            {i < STOPS.length - 1 ? <>Next <ArrowRight size={13} /></> : 'Start building 🚀'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
