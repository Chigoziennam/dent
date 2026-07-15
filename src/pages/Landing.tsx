import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, GitCommitHorizontal, Rocket, Sparkles, Brain, Trophy, ScrollText, Check } from 'lucide-react'
import { Orbs, CountUp, Logo } from '../components/ui'
import { Mascot } from '../components/Mascot'

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-base">
      <Orbs />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-bold tracking-tight">ShipLog</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted">by Nalto</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pricing" className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-secondary transition-colors hover:text-primary">
            Pricing
          </Link>
          <Link to="/login" className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-medium text-secondary transition-colors hover:border-line-hover hover:text-primary">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[82dvh] flex-col items-center justify-center px-5 text-center">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
          <motion.h1
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } }}
            className="text-[40px] font-bold leading-[1.05] tracking-tight md:text-[64px]"
          >
            Build in Public.
            <br />
            <span className="text-gradient">Without Thinking About It.</span>
          </motion.h1>
          <motion.p
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } }}
            className="mx-auto mt-5 max-w-[560px] text-[16px] leading-relaxed text-secondary md:text-lg"
          >
            Your AI companion that remembers every commit, every deploy, every milestone —
            and turns your work into content people love.
          </motion.p>
          <motion.div
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="sheen flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_32px_rgba(99,102,241,0.4)]"
              >
                Start Building <ArrowRight size={16} />
              </Link>
            </motion.div>
            <a href="#how" className="flex items-center gap-2 rounded-xl border border-line px-6 py-3.5 text-[15px] font-medium text-secondary transition-colors hover:border-line-hover hover:text-primary">
              See how it works
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Transformation animation */}
      <section id="how" className="relative z-10 mx-auto max-w-2xl px-5 py-20">
        <div className="mb-6 flex justify-center"><Mascot size={96} /></div>
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">One commit becomes everything.</h2>
        <p className="mt-2 text-center text-secondary">Watch your Tuesday afternoon turn into Friday's content.</p>
        <TransformationLoop />
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid gap-4 md:grid-cols-3"
        >
          {FEATURES.map(f => (
            <motion.div
              key={f.title}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}
              whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.12)' }}
              className="glass p-6"
            >
              <f.icon size={22} className="text-accent" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Integrations */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">Connects to your entire stack</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
          {['GitHub', 'Vercel', 'Stripe', 'Supabase', 'Linear', 'Notion', 'Slack', 'Discord', 'n8n', 'Claude'].map((name, i) => (
            <motion.span
              key={name}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3 + (i % 4) * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
              className="cursor-default font-mono text-sm text-secondary/60 transition-colors hover:text-primary"
            >
              {name}
            </motion.span>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">Built by founders, for founders</h2>
        <p className="mt-1 text-center text-xs text-muted">Beta numbers — and climbing</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { v: 12847, label: 'Events Logged' },
            { v: 2341, label: 'Posts Generated' },
            { v: 89, label: 'Weekly Consistency', suffix: '%' },
          ].map(m => (
            <div key={m.label} className="glass p-6 text-center">
              <CountUp value={m.v} suffix={m.suffix ?? ''} className="text-3xl font-bold text-primary" />
              <div className="mt-1 text-sm text-secondary">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-5 py-24 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-3xl font-bold tracking-tight md:text-5xl"
        >
          Your work deserves to be seen.
        </motion.h2>
        <motion.div whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
          <Link to="/login" className="flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(99,102,241,0.45)]">
            Start Building <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2"><Logo size={18} /> Nalto · ShipLog</div>
          <div>Built with ShipLog · Powered by Nalto</div>
        </div>
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon: GitCommitHorizontal, title: 'Ship Events', desc: 'Every commit, deploy, and milestone captured automatically from your tools.' },
  { icon: Sparkles, title: 'AI Writer', desc: 'Three voices — Founder, Technical, Storytelling — trained on your real work.' },
  { icon: Rocket, title: 'Weekly Digest', desc: 'Your entire week, summarized and ready to share every Friday.' },
  { icon: Brain, title: 'Founder Memory', desc: 'Ask “when did I finish auth?” and get an instant answer.' },
  { icon: Trophy, title: 'Achievements', desc: 'Level up with XP, badges, and shipping streaks that keep you moving.' },
  { icon: ScrollText, title: 'Public Changelog', desc: 'Auto-generated, beautifully designed, shareable proof of work.' },
]

// ── The signature morphing card loop ─────────────────────────────
const STAGES = [
  { key: 'commit', label: 'GitHub commit' },
  { key: 'changelog', label: 'Changelog entry' },
  { key: 'tweet', label: 'Tweet' },
  { key: 'linkedin', label: 'LinkedIn post' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'done', label: 'Scheduled' },
] as const

function TransformationLoop() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStage(s => (s + 1) % STAGES.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mt-10 flex flex-col items-center">
      <div className="relative flex h-[230px] w-full max-w-md items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={STAGES[stage].key}
            layoutId="morph-card"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-full p-5 text-left"
          >
            <StageCard stage={STAGES[stage].key} />
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Progress dots */}
      <div className="mt-5 flex items-center gap-2">
        {STAGES.map((s, i) => (
          <motion.div
            key={s.key}
            className="h-1.5 rounded-full bg-white/20"
            animate={{ width: i === stage ? 20 : 6, backgroundColor: i === stage ? '#6366f1' : 'rgba(255,255,255,0.15)' }}
          />
        ))}
      </div>
      <div className="mt-2 font-mono text-xs text-muted">{STAGES[stage].label}</div>
    </div>
  )
}

function StageCard({ stage }: { stage: (typeof STAGES)[number]['key'] }) {
  switch (stage) {
    case 'commit':
      return (
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="font-mono">a3f29b1</span>
            <span>· main · 2 min ago</span>
          </div>
          <div className="mt-2.5 font-mono text-sm text-primary">feat: add Stripe checkout flow</div>
          <div className="mt-2 text-xs text-secondary">+412 −38 · 9 files changed</div>
        </div>
      )
    case 'changelog':
      return (
        <div>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">v0.4.0</span>
          <div className="mt-2.5 text-sm font-semibold text-primary">Payments are live 💳</div>
          <div className="mt-1.5 text-xs leading-relaxed text-secondary">Full Stripe checkout with receipts, retries and webhooks. Upgrade from any plan page.</div>
        </div>
      )
    case 'tweet':
      return (
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/25 text-xs font-bold text-accent">C</div>
            <div><div className="text-xs font-semibold text-primary">Chigozie</div><div className="text-[11px] text-muted">@NaltoHQ</div></div>
            <span className="ml-auto font-bold text-primary">𝕏</span>
          </div>
          <div className="mt-2.5 text-[13px] leading-relaxed text-primary">Shipped Stripe checkout today. 9 files, one afternoon, zero regrets.<br /><br />Building in public, week 21. 🔥</div>
        </div>
      )
    case 'linkedin':
      return (
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#0a66c2]/30 text-xs font-bold text-[#7db8e8]">in</div>
            <div className="text-xs font-semibold text-primary">Chigozie · Founder at Nalto</div>
          </div>
          <div className="mt-2.5 text-[13px] leading-relaxed text-secondary">This week we shipped payments end-to-end. Here's what I learned about webhooks the hard way…</div>
        </div>
      )
    case 'newsletter':
      return (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">The Ship Log · Issue #21</div>
          <div className="mt-2 text-sm font-semibold text-primary">Payments week 💸</div>
          <div className="mt-1.5 text-xs leading-relaxed text-secondary">Stripe checkout, PDF receipts, and the first paying customer. Full story inside.</div>
        </div>
      )
    case 'done':
      return (
        <div className="flex flex-col items-center py-3 text-center">
          <motion.svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <motion.circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.5"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
            <motion.path d="M7 12.5l3.2 3.2L17 9" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }} />
          </motion.svg>
          <div className="mt-2.5 text-sm font-semibold text-success">Scheduled ✓</div>
          <div className="mt-1 text-xs text-muted">4 posts queued for Friday, 9:00 AM</div>
        </div>
      )
  }
}
