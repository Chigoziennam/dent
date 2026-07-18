import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { Check, Shield, Workflow, Database, Bot, FileDown, KeyRound, ExternalLink, RefreshCw, Cloud, AlertCircle } from 'lucide-react'
import { useDent } from '../lib/store'
import { CATEGORY_META } from '../lib/types'
import { supabaseReady } from '../lib/supabase'
import { checkCloudHealth, syncHealth } from '../lib/sync'
import { verifyGithub, fetchGithubShips, fetchGithubRepos, type GithubAccount } from '../lib/github'
import { Page, SectionTitle } from '../components/ui'

const PIPELINE = [
  { icon: Workflow, title: 'Capture', text: 'Connect GitHub and Super Dent X reads your real commits and releases — categorized (feat → feature, fix → bugfix, release → deploy) and timestamped into your log.' },
  { icon: Shield, title: 'Secure', text: 'Your token stays on THIS device (localStorage) and talks straight to GitHub. It is never uploaded, never shared, never in anyone else’s browser.' },
  { icon: Database, title: 'Store', text: 'Every synced commit becomes a ship event in your timeline — deduped by commit hash, so re-syncing never creates copies. Your whole build history, queryable.' },
  { icon: Bot, title: 'Write', text: 'Those real commits become the raw material the AI writer turns into posts — receipts, not fluff. A commit + a deploy on the same day become one story.' },
]

export default function Integrations() {
  const { creds, setCreds, events, dailyLogs, profile, importEvents, userId } = useDent()
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const [ghUser, setGhUser] = useState(creds.githubUser ?? '')
  const [ghToken, setGhToken] = useState(creds.githubToken ?? '')
  const [account, setAccount] = useState<GithubAccount | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(creds.githubLastSync ?? null)
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exporting, setExporting] = useState(false)

  const ghConnected = Boolean(creds.githubUser)
  const notify = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200) }

  // Is the cloud ACTUALLY reachable? A deleted/paused Supabase project must
  // show up as a loud red warning, not a quiet green "Connected".
  const [cloud, setCloud] = useState<'checking' | 'ok' | 'unreachable' | 'unconfigured'>('checking')
  useEffect(() => { checkCloudHealth().then(setCloud) }, [])

  // On load, silently re-verify a saved GitHub connection so "Connected" is
  // always the truth, not a stale flag.
  useEffect(() => {
    if (!creds.githubUser) return
    verifyGithub({ user: creds.githubUser, token: creds.githubToken })
      .then(acc => {
        setAccount(acc)
        // Backfill the repo list for accounts connected before this existed.
        if (!creds.githubRepos?.length) {
          fetchGithubRepos({ user: creds.githubUser!, token: creds.githubToken }, 12)
            .then(repos => setCreds({ githubRepos: repos.map(r => r.name) }))
            .catch(() => { /* nicety only */ })
        }
      })
      .catch(() => setAccount(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connectGithub = async () => {
    if (!ghUser.trim()) return
    setVerifying(true)
    try {
      const acc = await verifyGithub({ user: ghUser.trim(), token: ghToken.trim() || undefined })
      setAccount(acc)
      setCreds({ githubUser: ghUser.trim(), githubToken: ghToken.trim() || undefined })
      notify(`Connected as @${acc.login} — ${acc.public_repos} public repos. Now hit Sync. ✓`)
      // Grab the repo names so the Today composer can offer them straight away,
      // even before the first commit sync. Best-effort — never blocks connect.
      fetchGithubRepos({ user: ghUser.trim(), token: ghToken.trim() || undefined }, 12)
        .then(repos => setCreds({ githubRepos: repos.map(r => r.name) }))
        .catch(() => { /* repo list is a nicety, not required */ })
      // Pull straight away so "connected" means something instantly.
      await runSync(ghUser.trim(), ghToken.trim() || undefined)
    } catch (e) {
      setAccount(null)
      notify((e as Error).message, 'err')
    } finally {
      setVerifying(false)
    }
  }

  const runSync = async (user = creds.githubUser!, token = creds.githubToken) => {
    if (!user) return
    setSyncing(true)
    try {
      const ships = await fetchGithubShips({ user, token }, 30)
      const added = importEvents(ships)
      const stamp = new Date().toISOString()
      setLastSync(stamp)
      setCreds({ githubLastSync: stamp })
      notify(added > 0
        ? `Synced ${added} new ${added === 1 ? 'commit' : 'commits'} from GitHub into your log. ✓`
        : ships.length > 0 ? 'Already up to date — no new commits since last sync.' : 'No commits in the last 30 days on this account.')
    } catch (e) {
      notify((e as Error).message, 'err')
    } finally {
      setSyncing(false)
    }
  }

  const rangeEvents = useMemo(
    () => events.filter(e => e.eventDate >= from && e.eventDate <= to).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [events, from, to],
  )

  // PDF: builds a styled report and hands it to html2pdf
  const exportPdf = async () => {
    if (rangeEvents.length === 0) { notify('No ships in that date range.', 'err'); return }
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

  const ghShipCount = useMemo(() => events.filter(e => e.source === 'github').length, [events])

  return (
    <Page>
      <p className="text-sm text-secondary">Connect GitHub and your real commits flow into the log. Your credentials never leave this device.</p>

      <motion.div
        initial="initial" animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
        className="mt-5 grid gap-4 lg:grid-cols-3"
      >
        {/* GitHub — the real one */}
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="glass p-5" style={account ? { borderColor: 'rgba(34,197,94,0.4)', boxShadow: '0 0 28px rgba(34,197,94,0.1)' } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-2xl">🐙</span>
            {account
              ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"><Check size={11} /> Connected</span>
              : ghConnected
                ? <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning"><AlertCircle size={11} /> Reconnect</span>
                : <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted">Not connected</span>}
          </div>
          <div className="mt-3 font-semibold">GitHub</div>

          {account ? (
            <div className="mt-2">
              <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2.5">
                <img src={account.avatar_url} alt="" className="h-9 w-9 rounded-full" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-primary">{account.name ?? account.login}</div>
                  <div className="truncate font-mono text-[11px] text-muted">@{account.login} · {account.public_repos} repos</div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                <span>{ghShipCount} commits in your log</span>
                {lastSync && <span>synced {format(new Date(lastSync), 'MMM d, HH:mm')}</span>}
              </div>
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => runSync()} disabled={syncing}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-50">
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing commits…' : 'Sync commits now'}
              </motion.button>
              <button type="button" onClick={() => { setAccount(null); setCreds({ githubUser: undefined, githubToken: undefined }); setGhToken('') }}
                className="mt-1.5 w-full text-center text-[10.5px] text-muted hover:text-secondary">Disconnect</button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-secondary">Reads your real commits & releases straight from GitHub. Username alone works for public repos; a token adds private + higher limits.</p>
              <div className="mt-3.5 space-y-2">
                <input value={ghUser} onChange={e => setGhUser(e.target.value)} placeholder="GitHub username (e.g. Chigoziennam)"
                  className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-xs placeholder:text-muted" />
                <input value={ghToken} onChange={e => setGhToken(e.target.value)} type="password" placeholder="Access token (optional, ghp_…)"
                  className="w-full rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-xs placeholder:text-muted" />
                <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={connectGithub} disabled={!ghUser.trim() || verifying}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-xs font-semibold text-white disabled:opacity-40">
                  <KeyRound size={12} /> {verifying ? 'Checking with GitHub…' : 'Connect & sync'}
                </motion.button>
                <a href="https://github.com/settings/tokens/new?description=Super Dent X&scopes=repo,read:user" target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-[10.5px] text-muted hover:text-accent">
                  Create a token on GitHub <ExternalLink size={9} />
                </a>
              </div>
            </>
          )}
        </motion.div>

        {/* Account & cloud — honest status, no fake toggles */}
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="glass p-5"
          style={cloud === 'unreachable' ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 28px rgba(239,68,68,0.08)' } : userId ? { borderColor: 'rgba(99,102,241,0.35)' } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-2xl">☁️</span>
            {cloud === 'unreachable'
              ? <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400"><AlertCircle size={11} /> Not backing up</span>
              : userId
                ? <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success"><Check size={11} /> Syncing</span>
                : <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-muted">Local only</span>}
          </div>
          <div className="mt-3 font-semibold">Account & Cloud</div>
          {cloud === 'unreachable' ? (
            <p className="mt-1 text-xs leading-relaxed text-red-300">
              The cloud database can't be reached — your data is only on this device right now, and other browsers won't remember you.
              Check that the Supabase project still exists and the URL/key in the environment are current.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-secondary">
              {userId
                ? 'You’re signed in — every ship, log and post mirrors to the cloud and comes back on any device you sign in on.'
                : 'You’re working locally. Sign in with GitHub or email to back your log up to the cloud and keep it across devices.'}
            </p>
          )}
          <div className="mt-3.5 space-y-2 text-[12px]">
            <Row icon={Cloud} label="Cloud backend"
              ok={supabaseReady && cloud === 'ok'}
              okText="Connected"
              offText={cloud === 'checking' ? 'Checking…' : cloud === 'unreachable' ? 'Unreachable' : 'Not configured'} />
            <Row icon={Shield} label="Signed-in account" ok={Boolean(userId)} okText={profile.displayName || 'You'} offText="Not signed in" />
            <Row icon={Database} label="Events backed up" ok={Boolean(userId) && cloud === 'ok' && events.length > 0} okText={`${events.length} events`} offText={`${events.length} local`} />
          </div>
          {syncHealth().error && cloud !== 'unreachable' && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-2.5 py-1.5 font-mono text-[10px] text-red-300">
              Last sync error: {syncHealth().error}
            </p>
          )}
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            Signing out no longer wipes your data — sign back in with the same account and everything is exactly where you left it.
          </p>
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
            className={`glass-strong fixed bottom-24 left-1/2 z-50 -translate-x-1/2 max-w-[90vw] px-4 py-2.5 text-[13px] md:bottom-8 ${toast.kind === 'err' ? 'text-red-300' : 'text-primary'}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

function Row({ icon: Icon, label, ok, okText, offText }: { icon: typeof Cloud; label: string; ok: boolean; okText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2">
      <span className="flex items-center gap-2 text-secondary"><Icon size={13} className="text-muted" /> {label}</span>
      <span className={`font-medium ${ok ? 'text-success' : 'text-muted'}`}>{ok ? okText : offText}</span>
    </div>
  )
}
