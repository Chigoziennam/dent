import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight, Shield, Workflow, Database, Bot } from 'lucide-react'
import { Page, stagger, SectionTitle } from '../components/ui'

// Three first-class integrations. Everything else rides through n8n —
// it's the universal adapter, so we never build one-off OAuth flows.
const INTEGRATIONS = [
  {
    name: 'GitHub', emoji: '🐙', connected: true,
    captures: 'commits, PRs, issues — pushed to your log seconds after you push',
    last: '2 minutes ago',
  },
  {
    name: 'Vercel', emoji: '▲', connected: false,
    captures: 'production deploys, preview URLs, build failures',
  },
  {
    name: 'n8n', emoji: '🔁', connected: false,
    captures: 'everything else — Stripe, Linear, Notion, Slack, your own webhooks',
    universal: true,
  },
]

const PIPELINE = [
  { icon: Workflow, title: 'Capture', text: 'Your tools fire webhooks at n8n workflows on our server. GitHub push → parsed, categorized (feat → feature, fix → bugfix), timestamped.' },
  { icon: Shield, title: 'Secure', text: 'OAuth tokens live in n8n’s encrypted credentials vault — never in the app, never in your browser. The app only ever sees events.' },
  { icon: Database, title: 'Store', text: 'Every event lands in Postgres: ship_events, daily_logs, weekly_digests. Your entire building history, queryable forever.' },
  { icon: Bot, title: 'Companion', text: 'Once a day, the AI reads your recent ships and leaves one short note — motivation with receipts, never spam. Fridays it drafts your content.' },
]

export default function Integrations() {
  const [toast, setToast] = useState<string | null>(null)

  const connect = (name: string) => {
    setToast(`${name} — coming with the backend launch. You're on the list ✓`)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <Page>
      <p className="text-sm text-secondary">Three connections. Infinite coverage — n8n adapts to everything else.</p>

      <motion.div initial="initial" animate="animate" variants={stagger} className="mt-5 grid gap-3 lg:grid-cols-3">
        {INTEGRATIONS.map(i => (
          <motion.div
            key={i.name}
            variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
            whileHover={{ y: -2 }}
            className="glass p-5"
            style={i.connected
              ? { borderColor: 'rgba(99,102,241,0.4)', boxShadow: '0 0 28px rgba(99,102,241,0.12), 0 8px 32px rgba(0,0,0,0.4)' }
              : i.universal ? { borderColor: 'rgba(236,72,153,0.3)' } : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{i.emoji}</span>
              {i.connected ? (
                <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"><Check size={11} /> Connected</span>
              ) : (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => connect(i.name)}
                  className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-secondary transition-all hover:border-accent/50 hover:text-accent">
                  Connect <ArrowRight size={11} />
                </motion.button>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 font-semibold">
              {i.name}
              {i.universal && <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pink-400">universal adapter</span>}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-secondary">{i.captures}</div>
            {i.connected && i.last && <div className="mt-2 font-mono text-[10px] text-muted">Last sync: {i.last}</div>}
          </motion.div>
        ))}
      </motion.div>

      {/* How the backend works */}
      <div className="mt-8">
        <SectionTitle>How your data flows</SectionTitle>
        <motion.div
          initial="initial" animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PIPELINE.map((p, idx) => (
            <motion.div
              key={p.title}
              variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
              className="glass relative p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
                <p.icon size={17} className="text-accent" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted">0{idx + 1}</span>
                <span className="font-semibold">{p.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">{p.text}</p>
              {idx < PIPELINE.length - 1 && (
                <motion.div
                  className="absolute -right-2 top-1/2 hidden text-accent lg:block"
                  animate={{ x: [0, 4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.3 }}
                >
                  →
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
        <p className="mt-4 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-muted">
          Runs on your own infrastructure: n8n + Postgres behind Caddy. No third-party data brokers —
          your building history belongs to you, and the AI companion only reads, never shares.
        </p>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="glass-strong fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-4 py-2.5 text-[13px] text-primary md:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}
