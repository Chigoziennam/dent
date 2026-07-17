import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { Check, Shield, Workflow, Database, Bot, FileDown, KeyRound, ExternalLink } from 'lucide-react'
import { useDent } from '../lib/store'
import { CATEGORY_META } from '../lib/types'
import { Page, SectionTitle } from '../components/ui'

const PIPELINE = [
  { icon: Workflow, title: 'Capture', text: 'Your tools fire webhooks at n8n workflows on our server. GitHub push → parsed, categorized (feat → feature, fix → bugfix), timestamped.' },
  { icon: Shield, title: 'Secure', text: 'Your tokens stay on THIS device (localStorage) until cloud sync — then they move to n8n’s encrypted vault. Never in anyone else’s browser.' },
  { icon: Database, title: 'Store', text: 'Every event lands in Postgres: ship_events, daily_logs, weekly_digests. Your entire building history, queryable forever.' },
  { icon: Bot, title: 'Companion', text: 'Once a day, the AI reads your recent ships and leaves one short note — motivation with receipts, never spam. Fridays it drafts your content.' },
]

export default function Integrations() {
  const { creds, setCreds, events, dailyLogs, profile } = useDent()
  const [toast, setToast] = useState<string | null>(null)
  const [ghToken, setGhToken] = useState(creds.githubToken ?? '')
  const [ghUser, setGhUser] = useState(creds.githubUser ?? '')
  const [sbUrl, setSbUrl] = useState(creds.supabaseUrl ?? '')
  const [sbAnon, setSbAnon] = useState(creds.supabaseAnon ?? '')
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exporting, setExporting] = useState(false)

  const ghConnected = Boolean(creds.githubToken && creds.githubUser)
  const sbConnected = Boolean(creds.supabaseUrl && creds.supabaseAnon)

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600) }

  const saveGithub = () => {
    if (!ghToken.trim() || !ghUser.trim()) return
    setCreds({ githubToken: ghToken.trim(), githubUser: ghUser.trim() })
    notify('GitHub connected — capture activates with the n8n backend ✓')
  }
  const saveSupabase = () => {
    if (!sbUrl.trim() || !sbAnon.trim()) return
    setCreds({ supabaseUrl: sbUrl.trim().replace(/\/rest\/v1\/?$/, ''), supabaseAnon: sbAnon.trim() })
    notify('Supabase connected — your log can sync to your own database ✓')
  }

  const rangeEvents = useMemo(
    () => events.filter(e => e.eventDate >= from && e.eventDate <= to).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [events, from, to],
  )

  // PDF: builds a styled report and hands it to html2pdf
  const exportPdf = async () => {
    if (rangeEvents.length === 0) { notify('No ships in that date range.'); return }
    setExporting(true)
    const { default: html2pdf } = await import('html2pdf.js')
    const milestones = rangeEvents.filter(e => e.category === 'milestone' || e.isPinned)
    const logs = dailyLogs.filter(l => l.logDate >= from && l.logDate <= to)
    const el = document.createElement('div')
    el.innerHTML = `
      <div style="font-family: Helvetica, Arial, sans-serif; color: #1a1a2e; padding: 32px; max-width: 700px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom: 3px solid #6366f1; padding-bottom: 12px;">
          <div>
            <div style="font-size: 26px; font-weight: 800;">Super Dent X — Proof of Work</div>
            <div style="font-size: 13px; color: #555;">${profile.displayName} · ${profile.projectName} · ${from} → ${to}</div>
          </div>
          <div style="font-size: 12px; color: #6366f1; font-weight: 700;">🔥 ${profile.streakCurrent}-day streak</div>
        </div>
        <div style="display:flex; gap: 24px; margin: 18px 0; font-size: 13px;">
          <div><b style="font-size: 20px;">${rangeEvents.length}</b> ships</div>
          <div><b style="font-size: 20px;">${milestones.length}</b> milestones</div>
          <div><b style="font-size: 20px;">${logs.length}</b> daily logs</div>
        </div>
        ${milestones.length ? `<div style="font-size: 15px; font-weight: 700; margin: 16px 0 8px; color: #b45309;">★ Milestones</div>
        ${milestones.map(e => `<div style="padding: 7px 10px; border-left: 3px solid #f59e0b; background: #fffbeb; margin-bottom: 5px; font-size: 13px;"><b>${e.eventDate}</b> — ${e.title}</div>`).join('')}` : ''}
        <div style="font-size: 15px; font-weight: 700; margin: 16px 0 8px; color: #4338ca;">All ships</div>
        ${rangeEvents.map(e => `<div style="padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12.5px;"><span style="color:#888; font-family: monospace;">${e.eventDate}</span> · <span style="color:${CATEGORY_META[e.category].color}; font-weight:600;">${CATEGORY_META[e.category].label}</span> — ${e.title}</div>`).join('')}
        <div style="margin-top: 20px; font-size: 11px; color: #999; text-align: center;">Generated by Super Dent X · Build in Public. Without Thinking About It. · Powered by Nalto</div>
      </div>`
    await html2pdf().set({
      margin: 8,
      filename: `dent-${profile.username}-${from}-to-${to}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4' },
    }).from(el).save()
    setExporting(false)
    notify('PDF downloaded — your proof of work, portable ✓')
  }

  return (
    <Page>
      <p className="text-sm text-secondary">Three connections. Your credentials never leave this device.</p>

      <motion.div
        initial="initial" animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
        className="mt-5 grid gap-4 lg:grid-cols-3"
      >
        {/* GitHub */}
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="glass p-5" style={ghConnected ? { borderColor: 'rgba(34,197,94,0.4)', boxShadow: '0 0 28px rgba(34,197,94,0.1)' } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-2xl">🐙</span>
            {ghConnected
              ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"><Check size={11} /> Connected</span>
              : <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted">Not connected</span>}
          </div>
          <div className="mt-3 font-semibold">GitHub</div>
          <p className="mt-1 text-xs leading-relaxed text-secondary">Captures commits, PRs and issues the moment you push.</p>
          <div className="mt-3.5 space-y-2">
            <input value={ghUser} onChange={e => setGhUser(e.target.value)} placeholder="GitHub username"
              className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-xs placeholder:text-muted" />
            <input value={ghToken} onChange={e => setGhToken(e.target.value)} type="password" placeholder="Personal access token (ghp_…)"
              className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs placeholder:text-muted" />
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={saveGithub} disabled={!ghToken.trim() || !ghUser.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-40">
              <KeyRound size={12} /> {ghConnected ? 'Update credentials' : 'Connect GitHub'}
            </motion.button>
            <a href="https://github.com/settings/tokens/new?description=Super Dent X&scopes=repo,read:user" target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 text-[10.5px] text-muted hover:text-accent">
              Create a token on GitHub <ExternalLink size={9} />
            </a>
          </div>
        </motion.div>

        {/* Supabase */}
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="glass p-5" style={sbConnected ? { borderColor: 'rgba(34,197,94,0.4)', boxShadow: '0 0 28px rgba(34,197,94,0.1)' } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-2xl">⚡</span>
            {sbConnected
              ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"><Check size={11} /> Connected</span>
              : <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted">Not connected</span>}
          </div>
          <div className="mt-3 font-semibold">Supabase</div>
          <p className="mt-1 text-xs leading-relaxed text-secondary">Your own database — your log syncs to infrastructure you control.</p>
          <div className="mt-3.5 space-y-2">
            <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="Project URL (https://xxx.supabase.co)"
              className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs placeholder:text-muted" />
            <input value={sbAnon} onChange={e => setSbAnon(e.target.value)} type="password" placeholder="Anon key (eyJ…)"
              className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs placeholder:text-muted" />
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={saveSupabase} disabled={!sbUrl.trim() || !sbAnon.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-40">
              <KeyRound size={12} /> {sbConnected ? 'Update credentials' : 'Connect Supabase'}
            </motion.button>
            <span className="block text-center text-[10.5px] text-muted">Dashboard → Project Settings → API</span>
          </div>
        </motion.div>

        {/* PDF Export */}
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="glass p-5" style={{ borderColor: 'rgba(236,72,153,0.3)' }}>
          <div className="flex items-center justify-between">
            <span className="text-2xl">📄</span>
            <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pink-400">always yours</span>
          </div>
          <div className="mt-3 font-semibold">PDF Report</div>
          <p className="mt-1 text-xs leading-relaxed text-secondary">Every ship and milestone between two dates — a portable proof-of-work document.</p>
          <div className="mt-3.5 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">From</span>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted">To</span>
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
                className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs" />
            </label>
            <div className="text-center font-mono text-[10.5px] text-muted">{rangeEvents.length} ships in range</div>
            <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={exportPdf} disabled={exporting || rangeEvents.length === 0}
              className="sheen flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-40">
              <FileDown size={12} /> {exporting ? 'Building your PDF…' : 'Download PDF'}
            </motion.button>
          </div>
        </motion.div>
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
            </motion.div>
          ))}
        </motion.div>
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
