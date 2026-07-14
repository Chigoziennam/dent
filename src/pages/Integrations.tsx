import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { Page, stagger } from '../components/ui'

const INTEGRATIONS = [
  { name: 'GitHub', emoji: '🐙', connected: true, captures: 'commits, PRs, issues', last: '2 minutes ago' },
  { name: 'Vercel', emoji: '▲', connected: false, captures: 'deployments, preview URLs' },
  { name: 'Stripe', emoji: '💳', connected: false, captures: 'payments, new customers, MRR changes' },
  { name: 'Supabase', emoji: '⚡', connected: false, captures: 'migrations, edge function deploys' },
  { name: 'Linear', emoji: '📐', connected: false, captures: 'issues completed, cycle progress' },
  { name: 'Notion', emoji: '📓', connected: false, captures: 'page updates, database changes' },
  { name: 'Slack', emoji: '💬', connected: false, captures: 'key messages (opt-in channels)' },
  { name: 'n8n', emoji: '🔁', connected: false, captures: 'workflow executions, errors' },
]

export default function Integrations() {
  const [toast, setToast] = useState<string | null>(null)

  const connect = (name: string) => {
    setToast(`${name} — coming soon. You're on the waitlist ✓`)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <Page>
      <p className="text-sm text-secondary">Connect your stack. ShipLog captures the work as it happens.</p>
      <motion.div initial="initial" animate="animate" variants={stagger} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map(i => (
          <motion.div
            key={i.name}
            variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
            whileHover={{ y: -2 }}
            className="glass p-5"
            style={i.connected ? { borderColor: 'rgba(99,102,241,0.4)', boxShadow: '0 0 28px rgba(99,102,241,0.12), 0 8px 32px rgba(0,0,0,0.4)' } : undefined}
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
            <div className="mt-3 font-semibold">{i.name}</div>
            <div className="mt-1 text-xs leading-relaxed text-secondary">Captures: {i.captures}</div>
            {i.connected && i.last && <div className="mt-2 font-mono text-[10px] text-muted">Last sync: {i.last}</div>}
          </motion.div>
        ))}
      </motion.div>

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
