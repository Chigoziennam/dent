import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ScrollText, Copy, Check, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useDent } from '../lib/store'
import { Page, stagger } from '../components/ui'
import { Markdownish } from '../components/Markdownish'

export default function Changelog() {
  const { changelog, profile } = useDent()
  const navigate = useNavigate()
  const latest = changelog[0]?.publishedAt

  return (
    <Page className="max-w-3xl">
      {/* Header — frames what a changelog IS here: stories, not raw commits. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <ScrollText size={18} />
            </span>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Changelog</h1>
          </div>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-secondary">
            The story of what you shipped — <span className="text-primary">curated, not captured</span>.
            Each entry is one milestone worth telling someone about, drawn from your ships.
          </p>
        </div>
        <Link
          to={`/${profile.username}/changelog`}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-line-hover"
        >
          Public page <ExternalLink size={12} />
        </Link>
      </div>

      {/* Stat strip — a little proof-of-progress. */}
      {changelog.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Stat label={changelog.length === 1 ? 'story published' : 'stories published'} value={String(changelog.length)} />
          {latest && <Stat label="latest" value={latest} />}
          <Stat label="visible to" value="anyone with your link" />
        </div>
      )}

      {changelog.length === 0 ? (
        <EmptyChangelog onWrite={() => navigate('/app/week')} />
      ) : (
        <motion.div initial="initial" animate="animate" variants={stagger} className="relative mt-7 space-y-4">
          {/* The spine that turns a list into a timeline. */}
          <div className="pointer-events-none absolute bottom-4 left-[7px] top-4 w-px bg-line sm:left-[9px]" aria-hidden />
          {changelog.map(entry => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </motion.div>
      )}
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-2">
      <div className="text-sm font-semibold leading-tight text-primary">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

function Entry({ entry }: { entry: { id: string; versionTag: string; title: string; body: string; publishedAt: string } }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${entry.title}\n\n${entry.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — no-op */ }
  }

  return (
    <motion.article
      variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
      className="relative pl-6 sm:pl-8"
    >
      {/* Timeline node */}
      <span className="absolute left-0 top-6 h-3.5 w-3.5 rounded-full border-2 border-accent bg-base sm:top-7" aria-hidden />
      <div className="glass group p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {entry.versionTag && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-accent">{entry.versionTag}</span>
          )}
          <span className="font-mono text-xs text-muted">{entry.publishedAt}</span>
          <button
            onClick={copy}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-secondary"
            aria-label="Copy this entry"
          >
            {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <h2 className="mt-2.5 text-lg font-bold tracking-tight">{entry.title}</h2>
        <Markdownish text={entry.body} className="mt-2 space-y-1 text-sm leading-relaxed text-secondary" />
      </div>
    </motion.article>
  )
}

function EmptyChangelog({ onWrite }: { onWrite: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass mt-7 flex flex-col items-center px-6 py-12 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <ScrollText size={26} />
      </span>
      <h2 className="mt-4 text-lg font-bold tracking-tight">No stories yet</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-secondary">
        Your changelog fills itself from the work you log. It doesn't dump every commit —
        it surfaces the one line worth telling someone. Ship a few things, then publish your
        week and it lands here as a story.
      </p>
      <div className="mt-5 flex flex-col gap-3 text-left sm:flex-row">
        <Step n={1} title="Log your ships" body="Commits, deploys, milestones — on Today." />
        <Step n={2} title="Publish the week" body="This Week groups them into a story." />
        <Step n={3} title="Share it" body="It becomes a public changelog entry." />
      </div>
      <button
        onClick={onWrite}
        className="streak-gradient mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
      >
        <Sparkles size={15} /> Go to This Week
      </button>
    </motion.div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-white/[0.02] p-3.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">{n}</span>
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted">{body}</div>
    </div>
  )
}
