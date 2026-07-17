import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Rocket, TrendingUp, ArrowRight } from 'lucide-react'
import { useDent } from '../lib/store'
import { BRAND } from '../lib/brand'

// ── First-run: three questions, then the story starts ──
// New accounts land here once. We ask who they are, what they're building,
// and WHERE THEY'RE STARTING FROM — day-1 newbie or already launched —
// so the log, the AI and the public profile all speak from the right chapter.
const STAGES = [
  {
    key: 'spark' as const,
    icon: Sparkles,
    title: 'Just a spark',
    desc: 'New to tech or starting from zero. Day 1 goes in the log — future you will read this back after the blow-up.',
    color: '#fcd34d',
  },
  {
    key: 'building' as const,
    icon: Rocket,
    title: 'Building v1',
    desc: 'Deep in the build, not launched yet. Every commit and 2am fix becomes your launch story.',
    color: '#6366f1',
  },
  {
    key: 'launched' as const,
    icon: TrendingUp,
    title: 'Launched & climbing',
    desc: 'Live product, real users. Log revenue, milestones and lessons — receipts for the climb.',
    color: '#22c55e',
  },
]

export function Onboarding() {
  const { profile, completeOnboarding } = useDent()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.displayName === 'Builder' ? '' : profile.displayName)
  const [project, setProject] = useState('')
  const [tagline, setTagline] = useState('')
  const [stage, setStage] = useState<typeof STAGES[number]['key'] | null>(null)

  const finish = () => {
    if (!name.trim() || !project.trim() || !stage) return
    completeOnboarding({
      displayName: name.trim(),
      projectName: project.trim(),
      projectTagline: tagline.trim() || 'Building in public',
      startStage: stage,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="glass-strong w-full max-w-md p-7"
      >
        {/* progress */}
        <div className="mb-6 flex gap-1.5">
          {[0, 1].map(i => (
            <motion.div key={i} className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: step >= i ? '100%' : '0%' }}
                transition={{ duration: 0.4 }}
              />
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div key="who" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 className="text-xl font-bold tracking-tight">Welcome to {BRAND.name} 🛰️</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                Your story gets logged from today. Two quick questions and the log is yours.
              </p>
              <div className="mt-5 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-secondary">What should we call you?</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)} autoFocus
                    placeholder="Your name — it's how the app greets you"
                    className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-secondary">What are you building?</label>
                  <input
                    value={project} onChange={e => setProject(e.target.value)}
                    placeholder="Project name — even a working title counts"
                    className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-secondary">One-liner (optional)</label>
                  <input
                    value={tagline} onChange={e => setTagline(e.target.value)}
                    placeholder="e.g. WhatsApp fee reminders for African schools"
                    className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
                  />
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!name.trim() || !project.trim()}
                onClick={() => setStep(1)}
                className="sheen mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)] disabled:opacity-40"
              >
                Next <ArrowRight size={15} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="stage" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 className="text-xl font-bold tracking-tight">Where are you starting from?</h2>
              <p className="mt-1.5 text-sm text-secondary">The log adapts to your chapter. No wrong answer.</p>
              <div className="mt-5 space-y-2.5">
                {STAGES.map(s => (
                  <motion.button
                    key={s.key} type="button" whileTap={{ scale: 0.98 }}
                    onClick={() => setStage(s.key)}
                    className="w-full rounded-2xl border p-4 text-left transition-all"
                    style={stage === s.key
                      ? { borderColor: s.color, background: `${s.color}14`, boxShadow: `0 0 24px ${s.color}33` }
                      : { borderColor: 'var(--edge)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <s.icon size={17} style={{ color: s.color }} />
                      <span className="text-sm font-semibold text-primary">{s.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-secondary">{s.desc}</p>
                  </motion.button>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep(0)} className="rounded-xl border border-line px-4 py-3 text-sm text-secondary hover:border-line-hover">
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!stage}
                  onClick={finish}
                  className="sheen flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)] disabled:opacity-40"
                >
                  Start my log 🚀
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
