import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, GitCommitHorizontal, Rocket, Sparkles, Brain, Trophy, ScrollText, Check } from 'lucide-react'
import { Orbs, SpaceBackdrop, CountUp, Logo } from '../components/ui'
import { Mascot } from '../components/Mascot'

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-base">
      <Orbs />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-bold tracking-tight">Super Dent X</span>
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
      <section className="relative z-10 flex min-h-[88dvh] flex-col items-center justify-center px-5 text-center">
        <SpaceBackdrop />
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
            className="mt-8 flex flex-col items-center gap-3"
          >
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="sheen flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-[15px] font-semibold text-white shadow-[0_0_40px_rgba(99,102,241,0.5)]"
              >
                Track me while I build <ArrowRight size={16} />
              </Link>
            </motion.div>
            <a href="#how" className="text-[13px] text-muted transition-colors hover:text-secondary">
              or see how it works ↓
            </a>
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } }}
            className="mx-auto mt-12 w-full max-w-xl"
          >
            <TerminalWindow />
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

      {/* Proof-of-work profile showcase */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Your work, on display.<br /><span className="text-gradient">Forever.</span></h2>
            <p className="mt-4 max-w-md leading-relaxed text-secondary">
              Every builder gets a public proof-of-work page. Your streak, your ships, your badges —
              a living portfolio that updates itself while you sleep. Send one link to an investor,
              a client, or your future co-founder.
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
              Claim your page <ArrowRight size={14} />
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: 1.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            className="glass noise relative !rounded-3xl p-6"
            style={{ boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 24px 64px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-3.5">
              <img src="/avatars/notionists-kernel.svg" alt="" className="h-14 w-14 rounded-2xl border border-line" />
              <div>
                <div className="font-bold">Chigozie</div>
                <div className="text-xs text-muted">@chigozie · building Super Dent X</div>
              </div>
              <div className="streak-gradient ml-auto rounded-full px-3 py-1 text-xs font-bold text-white">🔥 21</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[['226', 'ships'], ['Lv 6', 'Shipper'], ['12', 'badges']].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-line bg-white/[0.02] py-2.5">
                  <div className="font-mono text-sm font-bold text-primary">{v}</div>
                  <div className="text-[10px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {['feat: add Stripe checkout flow', 'Deployed fee portal v0.3', 'First school signed LOI 🎉'].map(t => (
                <div key={t} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-xs text-secondary">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" /> {t}
                </div>
              ))}
            </div>
            <div className="mt-3 text-center font-mono text-[10px] text-muted">dent.app/chigozie</div>
          </motion.div>
        </div>
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

      {/* Builders wall */}
      <section className="relative z-10 py-16">
        <h2 className="px-5 text-center text-2xl font-bold tracking-tight md:text-3xl">A home for people who ship.</h2>
        <p className="mx-auto mt-2 max-w-md px-5 text-center text-secondary">
          Solo founders, indie hackers, night-shift builders. The log is where their work stops disappearing.
        </p>
        <div className="mt-10 space-y-4 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}>
          <MarqueeRow builders={BUILDERS_A} dir="l" />
          <MarqueeRow builders={BUILDERS_B} dir="r" />
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
          <Link to="/login" className="sheen flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(99,102,241,0.45)]">
            Track me while I build <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2"><Logo size={18} /> Nalto · Super Dent X</div>
          <div>Built with Super Dent X · Powered by Nalto</div>
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

// ── Animated terminal: the product pitch in 6 lines ──────────────
const TERM_LINES = [
  { text: '$ git push origin main', color: '#f0f0f5' },
  { text: '✓ 3 commits captured by Super Dent X', color: '#22c55e' },
  { text: '✓ vercel deploy detected — production', color: '#22c55e' },
  { text: '✓ stripe: new customer event logged', color: '#22c55e' },
  { text: '✨ Friday thread drafted from 34 ships', color: '#a5b4fc' },
  { text: '→ you: just keep building', color: '#8888a0' },
]

function TerminalWindow() {
  const [lineIdx, setLineIdx] = useState(0)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    const current = TERM_LINES[lineIdx]
    if (!current) {
      const t = setTimeout(() => { setLineIdx(0); setChars(0) }, 3200)
      return () => clearTimeout(t)
    }
    if (chars < current.text.length) {
      const t = setTimeout(() => setChars(c => c + 1), lineIdx === 0 ? 45 : 14)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => { setLineIdx(i => i + 1); setChars(0) }, 520)
    return () => clearTimeout(t)
  }, [lineIdx, chars])

  return (
    <div className="glass overflow-hidden !rounded-2xl text-left">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-muted">founder@dent ~ %</span>
      </div>
      <div className="min-h-[168px] p-4 font-mono text-[12.5px] leading-relaxed">
        {TERM_LINES.slice(0, lineIdx).map(l => (
          <div key={l.text} style={{ color: l.color }}>{l.text}</div>
        ))}
        {TERM_LINES[lineIdx] && (
          <div className="caret" style={{ color: TERM_LINES[lineIdx].color }}>
            {TERM_LINES[lineIdx].text.slice(0, chars)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Builders wall: portraits of the people this is for ───────────
const av = (style: string, seed: string) => `/avatars/${style}-${seed}.svg`
const BUILDERS_A = [
  { name: 'Amara', role: 'indie SaaS, Lagos', img: av('notionists', 'amara'), quote: 'I stopped dreading Fridays. The thread writes itself.' },
  { name: 'Dev', role: 'solo founder, 2am shift', img: av('adventurer', 'dev'), quote: 'My streak is the only manager I answer to.' },
  { name: 'Kofi', role: 'fintech builder', img: av('notionists', 'kofi'), quote: 'Investors read my changelog before our first call.' },
  { name: 'Sara', role: 'design engineer', img: av('adventurer', 'sara'), quote: 'Six months of work I would have forgotten. Logged.' },
  { name: 'Tunde', role: 'agency → product', img: av('notionists', 'tunde'), quote: 'The evening logbook became my favorite ritual.' },
]
const BUILDERS_B = [
  { name: 'Lena', role: 'open-source maintainer', img: av('adventurer', 'lena'), quote: 'Release notes in my voice, not changelog-speak.' },
  { name: 'Ravi', role: 'bootstrapped B2B', img: av('notionists', 'ravi'), quote: 'First customer came from a week-12 recap post.' },
  { name: 'Maya', role: 'ML tinkerer', img: av('adventurer', 'maya'), quote: 'The pulse chart guilt-trips me better than any todo app.' },
  { name: 'Chuka', role: 'mobile dev, nights', img: av('notionists', 'chuka'), quote: 'The owl gets me. Night ships still count.' },
  { name: 'Ines', role: 'CEO in training', img: av('adventurer', 'ines'), quote: 'My resume is literally my ship log now.' },
]

function MarqueeRow({ builders, dir }: { builders: typeof BUILDERS_A; dir: 'l' | 'r' }) {
  const doubled = [...builders, ...builders]
  return (
    <div className="flex overflow-hidden">
      <div className={`flex shrink-0 gap-4 pr-4 ${dir === 'l' ? 'marquee-l' : 'marquee-r'}`}>
        {doubled.map((b, i) => (
          <div key={`${b.name}-${i}`} className="glass flex w-[300px] shrink-0 items-start gap-3 !rounded-2xl p-4">
            <img src={b.img} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl border border-line object-cover" />
            <div className="min-w-0">
              <p className="text-[13px] leading-snug text-primary">“{b.quote}”</p>
              <p className="mt-1.5 text-[11px] text-muted">{b.name} · {b.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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
