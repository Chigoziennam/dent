import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { subDays, format, parseISO, isToday, isYesterday } from 'date-fns'
import { Sparkles, Copy, Save, Check, ChevronDown, Wand2, Lock, Atom, ExternalLink, Github, ArrowRight, PenLine } from 'lucide-react'
import { useDent } from '../lib/store'
import { generateContent, humanize, fuse, composeUrl, tighten, toThread, statsLine, dedupeShips } from '../lib/ai'
import { repoOf } from '../lib/github'
import { entitlementsFor, platformAllowed } from '../lib/plan'
import { TONE_META, type ContentPlatform, type Tone, type EventCategory } from '../lib/types'
import { Page, CategoryPill, SectionTitle } from '../components/ui'

const PLATFORMS: { key: ContentPlatform; label: string; pro?: boolean }[] = [
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'threads', label: 'Threads' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'changelog', label: 'Changelog' },
  { key: 'blog', label: 'Blog' },
  { key: 'devto', label: 'Dev.to' },
  { key: 'producthunt', label: 'Product Hunt', pro: true },
  { key: 'resume', label: 'Resume Builder', pro: true },
]
const TONES = Object.keys(TONE_META) as Tone[]
const RANGES = [
  { key: 0, label: 'Today' },
  { key: 7, label: 'This Week' },
  { key: 30, label: 'This Month' },
  { key: 90, label: 'All 90 Days' },
]

export default function Write() {
  const { events, dailyLogs, profile, saveContent, content, creds } = useDent()
  // A beginner is someone with an empty log AND no GitHub connected — the one
  // moment to point them at the thing that makes the whole app work. Once they
  // have a single ship (or connect GitHub), they're a returning user and this
  // never shows again, so existing builders don't get re-onboarded.
  const isBeginner = events.length === 0 && !creds.githubToken
  const [mode, setMode] = useState<'ships' | 'manual' | 'fusion'>('ships')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Where the ships in the picker came from. GitHub commits arrive in bulk
  // and are newest-first, so a hand-logged milestone — the revenue note, the
  // launch, the customer call — used to get pushed past the cut and become
  // unpickable. These are usually the ships most worth writing about.
  const [source, setSource] = useState<'all' | 'manual' | 'github'>('all')
  const [state, setState] = useState('')
  const [opened, setOpened] = useState(false)
  const [platform, setPlatform] = useState<ContentPlatform>('twitter')
  const [tone, setTone] = useState<Tone>(profile.tone)
  const [range, setRange] = useState(7)
  const [body, setBody] = useState('')
  const [raw, setRaw] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  // Open by default: this section IS the choosing, and collapsing it on
  // mobile hid the checkboxes and bulk controls behind an unmarked tap.
  const [contextOpen, setContextOpen] = useState(true)
  // Quick lens over the source material. Writing about "just this week's
  // commits" or "only the milestones" is a normal ask — without these you
  // have to untap thirty rows by hand to get there.
  const [lens, setLens] = useState<'all' | 'code' | 'wins' | 'week'>('all')
  // Day picker: narrow the source to specific dates. Empty = every day in
  // range. This is the "write about just Monday & Tuesday" control — each day
  // shows how many actions landed on it, so you pick by what actually happened.
  const [days, setDays] = useState<Set<string>>(new Set())
  const [proNudge, setProNudge] = useState(false)

  // Accept a draft handed over from the Week page
  useEffect(() => {
    const raw = sessionStorage.getItem('shiplog-handoff')
    if (!raw) return
    sessionStorage.removeItem('shiplog-handoff')
    try {
      const h = JSON.parse(raw)
      if (h.body) setBody(h.body)
      if (h.platform) setPlatform(h.platform)
      if (h.tone) setTone(h.tone)
      if (h.mode) setMode(h.mode)
      if (typeof h.range === 'number') setRange(h.range)
      if (h.repo) setFocusRepo(h.repo)
    } catch { /* ignore */ }
  }, [])

  const cutoff = format(subDays(new Date(), range), 'yyyy-MM-dd')
  // Repo focus: when set, GitHub ships are narrowed to that repo; manual
  // ships (milestones, revenue, customer notes) still ride along — they
  // belong to the project story regardless of which repo they touch.
  const [focusRepo, setFocusRepo] = useState<string | null>(null)
  const inRange = useMemo(() => events.filter(e => e.eventDate >= cutoff), [events, cutoff])
  const rangeRepos = useMemo(
    () => [...new Set(inRange.map(repoOf).filter((r): r is string => !!r))].slice(0, 8),
    [inRange],
  )
  // Deduped up front: a commit+deploy pair (same title, same minute) and any
  // ships that got backfilled twice collapse to one row here, so the picker,
  // the counts and the day breakdown never show the same ship twice.
  const rangeEvents = useMemo(
    () => dedupeShips(inRange.filter(e => !focusRepo || e.source !== 'github' || repoOf(e) === focusRepo)),
    [inRange, focusRepo],
  )
  // Hand-picking: every ship in range is IN by default; tap one to leave it
  // out. This is how you talk about exactly the commits you choose — the
  // site offers them, you decide.
  // Opt-in: nothing is chosen until you tap it. Starts empty (a clean "clear
  // all"), and resets to empty whenever the window/source/lens/days change, so
  // you always start from a blank slate and add exactly the ships you want.
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  useEffect(() => { setChosen(new Set()) }, [range, focusRepo, source, lens, days])
  // Day picks reset when the window or source underneath them changes — the
  // dates on offer are different, so a stale selection would silently hide
  // everything.
  useEffect(() => { setDays(new Set()) }, [range, focusRepo, source])
  const toggleDay = (d: string) => setDays(prev => {
    const next = new Set(prev)
    if (next.has(d)) next.delete(d); else next.add(d)
    return next
  })
  // Each day in range and how many actions landed on it — the source for the
  // day chips, and the "details" the picker was missing. Scoped by source so
  // the counts match what "Logged by me" / "From GitHub" is showing.
  const dayBuckets = useMemo(() => {
    const base = rangeEvents.filter(e =>
      source === 'github' ? e.source === 'github'
      : source === 'manual' ? e.source !== 'github'
      : true,
    )
    const m = new Map<string, number>()
    for (const e of base) m.set(e.eventDate, (m.get(e.eventDate) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, count]) => ({ date, count }))
  }, [rangeEvents, source])
  const toggleShip = (id: string) => setChosen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  // Source-filtered and manual-first. GitHub commits arrive in bulk and are
  // newest-first, so hand-logged ships — the launch, the revenue note, the
  // customer call — used to be pushed past the display cut and become
  // invisible. They are usually the ships most worth writing about.
  const sourceEvents = useMemo(() => {
    const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const filtered = rangeEvents.filter(e => {
      if (source === 'github' && e.source !== 'github') return false
      if (source === 'manual' && e.source === 'github') return false
      if (days.size > 0 && !days.has(e.eventDate)) return false
      if (lens === 'code') return e.category === 'commit' || e.category === 'deployment' || e.category === 'bugfix'
      if (lens === 'wins') return ['milestone', 'revenue', 'customer', 'launch', 'feature'].includes(e.category)
      if (lens === 'week') return e.eventDate >= weekAgo
      return true
    })
    return [...filtered.filter(e => e.source !== 'github'), ...filtered.filter(e => e.source === 'github')]
  }, [rangeEvents, source, lens, days])

  const activeEvents = useMemo(() => sourceEvents.filter(e => chosen.has(e.id)), [sourceEvents, chosen])

  // What the Fusion picker offers. Manual ships sort FIRST, then the cap
  // applies — otherwise a busy commit week buries the milestone you actually
  // wanted to post about. Raised 20 -> 40 as well; the list scrolls.
  const pickable = useMemo(() => sourceEvents.slice(0, 40), [sourceEvents])
  const rangeLogs = useMemo(() => dailyLogs.filter(l => l.logDate >= cutoff), [dailyLogs, cutoff])

  const pickPlatform = (p: { key: ContentPlatform; pro?: boolean }) => {
    setPlatform(p.key)
    if (p.pro) {
      setProNudge(true)
      setTimeout(() => setProNudge(false), 4000)
    }
  }

  const tryUseAI = useDent(s => s.tryUseAI)
  const aiLeft = useDent(s => s.aiLeftThisWeek())
  const ent = entitlementsFor(profile)
  const [gate, setGate] = useState<string | null>(null)

  const generate = async () => {
    // Feature gates before we spend an AI call.
    if (mode === 'manual' && !ent.humanWriter) {
      setGate('The Raw notes → Human writer is a Pro feature. Upgrade to unlock it.')
      return
    }
    if (!platformAllowed(platform, profile)) {
      setGate(`${PLATFORMS.find(p => p.key === platform)?.label} is a CEO Mode output. Upgrade to publish there.`)
      return
    }
    if (mode === 'ships' && activeEvents.length === 0) {
      setGate(rangeEvents.length === 0
        ? 'No ships in this range yet — log something or sync GitHub first.'
        : 'Pick the ships you want in the post first — tap one or more below.')
      return
    }
    if (!tryUseAI()) {
      setGate(`You've used all ${ent.aiPerWeek} free AI generations this week. Go Pro for unlimited.`)
      return
    }
    setGate(null)
    setGenerating(true)
    const text = mode === 'manual'
      ? await humanize(raw, platform, tone, profile.projectName)
      : mode === 'fusion'
        ? await fuse({
            picked: rangeEvents.filter(e => picked.has(e.id)),
            state, platform, tone, projectName: profile.projectName,
          })
        : await generateContent({
            events: activeEvents, dailyLogs: rangeLogs, platform, tone,
            projectName: profile.projectName, projectTagline: profile.projectTagline,
          })
    setBody(text)
    setGenerating(false)
  }

  const togglePick = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Copy the post, then jump straight into the platform's composer
  const copyAndOpen = async () => {
    await navigator.clipboard.writeText(body)
    const { url } = composeUrl(platform, body)
    if (url) window.open(url, '_blank', 'noopener')
    setOpened(true); setTimeout(() => setOpened(false), 2500)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(body)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const save = () => {
    if (!body.trim()) return
    saveContent({ platform, tone, title: `${platform} · ${format(new Date(), 'MMM d')}`, body, status: 'draft' })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  // The day picker — shared by "From my ships" and "Fusion". Each day in the
  // window is a CARD stamped with its action count; tap to narrow the source
  // to just those days, then a detail strip breaks down what happened.
  const dayLabel = (d: string) => {
    const date = parseISO(d)
    return isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE')
  }
  const daySub = (d: string) => {
    const date = parseISO(d)
    return isToday(date) || isYesterday(date) ? format(date, 'MMM d') : format(date, 'MMM d')
  }
  const busiest = Math.max(1, ...dayBuckets.map(d => d.count))
  // What's actually feeding the post right now, grouped by category — the
  // "detailed window" you get once you've picked your days.
  const shownBreakdown = useMemo(() => {
    const m = new Map<EventCategory, number>()
    for (const e of sourceEvents) m.set(e.category, (m.get(e.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [sourceEvents])

  const dayPicker = dayBuckets.length > 1 && (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Pick your days</span>
        {days.size > 0 && (
          <button type="button" onClick={() => setDays(new Set())} className="text-[10px] font-medium text-accent hover:underline">
            All {dayBuckets.length} days
          </button>
        )}
      </div>
      {/* Day cards — the count is the story, so it's the biggest thing, with a
          little fill bar so a busy day literally stands taller. */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {dayBuckets.map(d => {
          const on = days.size === 0 || days.has(d.date)
          const picked = days.has(d.date)
          return (
            <button
              key={d.date} type="button" onClick={() => toggleDay(d.date)}
              aria-pressed={picked}
              className={`relative flex w-[62px] shrink-0 flex-col items-center gap-0.5 overflow-hidden rounded-xl border px-1 py-2 transition-all focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${picked ? 'border-accent bg-accent/15 shadow-[0_0_16px_rgba(99,102,241,0.35)]' : on ? 'border-line bg-white/[0.03] hover:border-accent/40' : 'border-line/50 opacity-45 hover:opacity-80'}`}
            >
              <span className={`text-lg font-bold leading-none tabular-nums ${picked ? 'text-accent' : 'text-primary'}`}>{d.count}</span>
              <span className={`text-[10px] font-semibold leading-tight ${picked ? 'text-accent' : 'text-secondary'}`}>{dayLabel(d.date)}</span>
              <span className="text-[9px] leading-tight text-muted">{daySub(d.date)}</span>
              <span className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/5">
                <span className="block h-full rounded-full bg-accent/70" style={{ width: `${Math.round((d.count / busiest) * 100)}%` }} />
              </span>
            </button>
          )
        })}
      </div>
      {/* Detail strip: exactly what's feeding the post after your picks */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
        <span className="text-[11px] font-semibold text-primary">
          {days.size === 0 ? 'All days' : `${days.size} ${days.size === 1 ? 'day' : 'days'}`} · {sourceEvents.length} {sourceEvents.length === 1 ? 'action' : 'actions'}
        </span>
        <span className="text-line">·</span>
        {shownBreakdown.length === 0
          ? <span className="text-[11px] text-muted">nothing on these days</span>
          : shownBreakdown.map(([cat, n]) => (
              <span key={cat} className="flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-secondary">
                <CategoryPill category={cat} /><span className="font-mono text-muted">{n}</span>
              </span>
            ))}
      </div>
    </div>
  )

  return (
    <Page className="max-w-6xl">
      {/* Beginners only: the log is empty and GitHub isn't connected. This is
          the goal — get their commits flowing in automatically. Disappears the
          moment they have a ship or a token, so returning users never see it. */}
      {isBeginner && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass relative mb-4 overflow-hidden p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Github size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight">Connect GitHub to start your log</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                This is the whole idea: connect once, and every commit, deploy and push shows up
                here automatically — no copy-paste, no remembering. Then Super Dent X turns that
                raw history into stories worth posting.
              </p>
            </div>
          </div>
          <div className="relative mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Link
              to="/app/integrations"
              className="streak-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              <Github size={16} /> Connect GitHub <ArrowRight size={15} />
            </Link>
            <Link
              to="/app/today"
              className="flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-secondary transition-colors hover:border-line-hover hover:text-primary"
            >
              <PenLine size={15} /> Or log your first ship by hand
            </Link>
          </div>
          <div className="relative mt-3.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="text-accent">1</span> Connect</span>
            <span className="flex items-center gap-1"><span className="text-accent">2</span> Commits auto-log as ships</span>
            <span className="flex items-center gap-1"><span className="text-accent">3</span> Write &amp; share the story</span>
          </div>
        </motion.div>
      )}

      {/* Mode switch: AI from ships vs. human-first manual */}
      <div className="mb-4 flex rounded-2xl border border-line bg-white/[0.02] p-1">
        {([
          { key: 'ships', label: 'From my ships', short: 'Ships', hint: 'AI drafts from your logged events', icon: Sparkles },
          { key: 'manual', label: 'Raw notes → Human', short: 'Humanize', hint: 'You talk, it shapes — never sounds like AI', icon: Wand2 },
          { key: 'fusion', label: 'Fusion', short: 'Fusion', hint: 'Pick ships + your state = the ultimate post', icon: Atom },
        ] as const).map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`relative flex-1 rounded-xl px-2 py-2.5 text-center transition-colors sm:px-4 sm:text-left ${mode === m.key ? 'text-primary' : 'text-muted hover:text-secondary'}`}
          >
            {mode === m.key && (
              <motion.div layoutId="write-mode" className="absolute inset-0 rounded-xl bg-accent/15 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <div className="relative flex items-center justify-center gap-1.5 text-[13.5px] font-semibold sm:justify-start sm:gap-2">
              <m.icon size={14} className={mode === m.key ? 'text-accent' : ''} />
              <span className="sm:hidden">{m.short}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </div>
            <div className="relative mt-0.5 hidden text-[11px] text-muted sm:block">{m.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Context panel */}
        <div className="min-w-0 lg:col-span-2">
          {mode === 'ships' ? (
            <div className="glass p-5">
              <button onClick={() => setContextOpen(o => !o)} className="flex w-full items-center justify-between lg:pointer-events-none">
                <SectionTitle>Source Material · {activeEvents.length > 0 ? `${activeEvents.length} of ${sourceEvents.length} chosen` : `${sourceEvents.length} events`}</SectionTitle>
                <ChevronDown size={14} className={`text-muted transition-transform lg:hidden ${contextOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* Where the material comes from. Manual ships (today's log,
                  milestones, revenue notes) and GitHub commits sit side by
                  side so you can write from either, or both. */}
              <div className="no-scrollbar mb-2 flex items-center gap-1.5 overflow-x-auto">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">Source</span>
                {([
                  { k: 'all' as const, label: 'Everything' },
                  { k: 'manual' as const, label: 'Logged by me' },
                  { k: 'github' as const, label: 'From GitHub' },
                ]).map(o => (
                  <button key={o.k} type="button" onClick={() => setSource(o.k)}
                    aria-pressed={source === o.k}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${source === o.k ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}>
                    {o.label}
                    <span className="ml-1 font-mono opacity-60">
                      {o.k === 'all' ? rangeEvents.length : rangeEvents.filter(e => o.k === 'github' ? e.source === 'github' : e.source !== 'github').length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="no-scrollbar mb-2 flex items-center gap-1.5 overflow-x-auto">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">Show</span>
                {([
                  { k: 'all' as const, label: 'All' },
                  { k: 'week' as const, label: 'Last 7 days' },
                  { k: 'code' as const, label: 'Code only' },
                  { k: 'wins' as const, label: 'Wins only' },
                ]).map(o => (
                  <button key={o.k} type="button" onClick={() => setLens(o.k)}
                    aria-pressed={lens === o.k}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${lens === o.k ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {/* Day picker — pick specific dates by how much happened on them */}
              {dayPicker}
              {/* Repo focus narrows the GitHub side only — manual ships belong
                  to the project story whichever repo they touched. */}
              {rangeRepos.length > 0 && source !== 'manual' && (
                <div className="no-scrollbar mb-3 flex items-center gap-1.5 overflow-x-auto">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">Repo</span>
                  <button
                    type="button" onClick={() => setFocusRepo(null)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${focusRepo === null ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}
                  >
                    All repos
                  </button>
                  {rangeRepos.map(r => (
                    <button
                      key={r} type="button" onClick={() => setFocusRepo(focusRepo === r ? null : r)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] ${focusRepo === r ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-secondary'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div className={`space-y-2 ${contextOpen ? '' : 'hidden lg:block'}`}>
                {/* The list only appears once you've picked a day (or days).
                    Showing all 34+ ships up front was a wall of scrolling — the
                    day cards are the index, and you drill into a day to choose
                    from just that day's ships. */}
                {dayBuckets.length > 1 && days.size === 0 ? (
                  <div className="rounded-xl border border-dashed border-line/70 px-4 py-7 text-center">
                    <div className="text-[13px] font-medium text-secondary">Pick a day above to see its ships</div>
                    <div className="mt-1 text-[11px] text-muted">Then tap the ones you want in the post.</div>
                  </div>
                ) : (
                <>
                <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
                  <button type="button" onClick={() => setChosen(new Set(sourceEvents.map(e => e.id)))}
                    disabled={chosen.size === sourceEvents.length && sourceEvents.length > 0}
                    className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                    Select all
                  </button>
                  <button type="button" onClick={() => setChosen(new Set())}
                    disabled={chosen.size === 0}
                    className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                    Clear all
                  </button>
                  <span className="font-mono text-[10.5px] text-accent">
                    {activeEvents.length} of {sourceEvents.length} chosen
                  </span>
                </div>
                <div className="pb-1 text-[10.5px] text-muted">Tap the ships you want in — the post only uses the ones you choose.</div>
                {sourceEvents.slice(0, 40).map(e => {
                  const on = chosen.has(e.id)
                  return (
                    <button
                      key={e.id} type="button" onClick={() => toggleShip(e.id)}
                      aria-pressed={on}
                      aria-label={`${on ? 'Remove' : 'Add'} ${e.title}`}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${on ? 'border-accent/60 bg-accent/10' : 'border-line bg-white/[0.02] opacity-60 hover:opacity-100'}`}
                    >
                      {/* Opt-in: filled check only once you've chosen the ship. */}
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] transition-colors ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>
                        {on && '✓'}
                      </span>
                      <span className="shrink-0"><CategoryPill category={e.category} /></span>
                      <span className={`min-w-0 flex-1 truncate text-xs ${on ? 'text-secondary' : 'text-muted'}`}>{e.title}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted">
                        {e.source === 'github' ? (repoOf(e) ?? 'github') : 'yours'}
                      </span>
                    </button>
                  )
                })}
                {sourceEvents.length > 40 && <div className="pt-1 text-center font-mono text-[11px] text-muted">+ {sourceEvents.length - 40} more feeding the AI</div>}
                </>
                )}
              </div>
            </div>
          ) : mode === 'fusion' ? (
            <div className="glass flex flex-col p-5">
              <SectionTitle>Step 1 · Pick your ships</SectionTitle>
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                  Tap the events that belong in this post — they become the facts.
                </p>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setPicked(new Set(pickable.map(e => e.id)))}
                    disabled={pickable.every(e => picked.has(e.id))}
                    className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                    Select all
                  </button>
                  <button type="button" onClick={() => setPicked(new Set())}
                    disabled={picked.size === 0}
                    className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                    Clear
                  </button>
                </span>
              </div>
              <div className="mb-2 flex gap-1.5">
                {([
                  { k: 'all' as const, label: 'Everything' },
                  { k: 'manual' as const, label: 'Logged by me' },
                  { k: 'github' as const, label: 'From GitHub' },
                ]).map(o => (
                  <button key={o.k} onClick={() => setSource(o.k)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${source === o.k ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-secondary'}`}>
                    {o.label}
                    <span className="ml-1 font-mono opacity-60">
                      {o.k === 'all' ? rangeEvents.length : rangeEvents.filter(e => o.k === 'github' ? e.source === 'github' : e.source !== 'github').length}
                    </span>
                  </button>
                ))}
              </div>
              {/* Day picker — narrow the pickable ships to specific dates */}
              {dayPicker}
              {dayBuckets.length > 1 && days.size === 0 ? (
                <div className="rounded-xl border border-dashed border-line/70 px-4 py-7 text-center">
                  <div className="text-[13px] font-medium text-secondary">Pick a day above to see its ships</div>
                  <div className="mt-1 text-[11px] text-muted">Then tap the ones to fuse into the post.</div>
                </div>
              ) : (
              <div className="no-scrollbar max-h-56 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
                {pickable.map(e => {
                  const on = picked.has(e.id)
                  return (
                    <button key={e.id} type="button" onClick={() => togglePick(e.id)}
                      aria-pressed={on}
                      aria-label={`${on ? 'Remove' : 'Add'} ${e.title}`}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${on ? 'border-accent/60 bg-accent/10' : 'border-line bg-white/[0.02] opacity-70 hover:opacity-100'}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>
                        {on && '✓'}
                      </span>
                      <span className="shrink-0"><CategoryPill category={e.category} /></span>
                      <span className="min-w-0 flex-1 truncate text-xs text-secondary">{e.title}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted">
                        {e.source === 'github' ? (repoOf(e) ?? 'github') : 'yours'}
                      </span>
                    </button>
                  )
                })}
              </div>
              )}
              <div className="mt-1.5 text-right font-mono text-[10px] text-muted">{picked.size} selected</div>
              <SectionTitle>Step 2 · Your current state</SectionTitle>
              <p className="mb-2 text-xs leading-relaxed text-muted">
                How does it actually feel right now? Tired, wired, proud, doubting — the fusion needs the human part.
              </p>
              <textarea
                value={state}
                onChange={e => setState(e.target.value)}
                rows={4}
                placeholder={`e.g. honestly exhausted but the demo went so well I can't sleep`}
                className="resize-none rounded-xl border border-line bg-white/[0.02] p-3.5 text-sm leading-relaxed placeholder:text-muted/60"
              />
            </div>
          ) : (
            <div className="glass flex flex-col p-5">
              <SectionTitle>Your raw material</SectionTitle>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                Brain-dump it. Bullet points, half sentences, voice-note energy — whatever's in your head.
                The writer keeps your facts and your voice, and strips everything that smells like AI.
              </p>
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                rows={12}
                placeholder={`e.g.\nfixed the auth bug finally, 3 days of pain\nshipped dark mode\ncustomer said the dashboard "feels like linear" (!!)\ntired but good`}
                className="flex-1 resize-none rounded-xl border border-line bg-white/[0.02] p-3.5 text-sm leading-relaxed placeholder:text-muted/60"
              />
            </div>
          )}

          {content.length > 0 && mode === 'ships' && (
            <div className="glass mt-4 hidden p-5 lg:block">
              <SectionTitle>Recent Drafts</SectionTitle>
              <div className="space-y-2">
                {content.slice(0, 4).map(c => (
                  <button key={c.id} onClick={() => { setBody(c.body); setPlatform(c.platform) }}
                    className="block w-full rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-line-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary">{c.title}</span>
                      <span className={`text-[10px] font-medium ${c.status === 'published' ? 'text-success' : 'text-warning'}`}>{c.status}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted">{c.body.split('\n')[0]}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="glass flex min-w-0 flex-col p-5 lg:col-span-3">
          {/* Platforms WRAP instead of scrolling off-screen. The old row hid
              its scrollbar, so on anything but a maximised laptop the last
              platforms ran off the right edge with no way to reach them. */}
          <div className="flex flex-wrap gap-1">
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => pickPlatform(p)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${platform === p.key ? 'bg-accent/15 text-accent' : 'text-secondary hover:text-primary'}`}>
                {p.label}
                {p.pro && <Lock size={10} className="text-warning" />}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {proNudge && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.07] px-3.5 py-2.5 text-xs">
                  <Lock size={13} className="shrink-0 text-warning" />
                  <span className="text-secondary">Product Hunt launches and the Resume Builder ship with <span className="font-semibold text-warning">CEO Mode</span> — free to try during the beta.</span>
                  <Link to="/pricing" className="ml-auto shrink-0 font-semibold text-warning hover:underline">See pricing →</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {TONES.map(t => (
              <button key={t} onClick={() => setTone(t)} title={TONE_META[t].hint}
                className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
                {TONE_META[t].label}
              </button>
            ))}
            <span className="hidden text-[10.5px] italic text-muted lg:inline">{TONE_META[tone].hint}</span>
            {mode !== 'manual' && <>
              <div className="mx-1 h-4 w-px bg-line" />
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${range === r.key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
                  {r.label}
                </button>
              ))}
            </>}
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={generate}
            disabled={generating || (mode === 'manual' && !raw.trim()) || (mode === 'fusion' && picked.size === 0)}
            className="sheen mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)] disabled:opacity-60"
          >
            {mode === 'manual' ? <Wand2 size={15} className={generating ? 'animate-pulse' : ''} /> : mode === 'fusion' ? <Atom size={15} className={generating ? 'animate-spin' : ''} /> : <Sparkles size={15} className={generating ? 'animate-pulse' : ''} />}
            {generating ? 'Writing…' : mode === 'manual' ? 'Make it human' : mode === 'fusion' ? `Fuse ${picked.size ? `${picked.size} ${picked.size === 1 ? 'ship' : 'ships'}` : 'ships'} + my state` : 'Generate ✨'}
          </motion.button>

          {/* Free-tier AI allowance + upgrade gate */}
          {Number.isFinite(aiLeft) && (
            <div className="mt-2 text-center text-[11px] text-muted">
              {aiLeft > 0
                ? <>{aiLeft} free AI {aiLeft === 1 ? 'generation' : 'generations'} left this week · <Link to="/pricing" className="text-accent hover:underline">go unlimited</Link></>
                : <>Out of free AI this week · <Link to="/pricing" className="font-semibold text-accent hover:underline">upgrade for unlimited →</Link></>}
            </div>
          )}
          <AnimatePresence>
            {gate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/[0.08] px-3.5 py-2.5 text-xs">
                  <Lock size={13} className="shrink-0 text-warning" />
                  <span className="text-secondary">{gate}</span>
                  <Link to="/pricing" className="ml-auto shrink-0 font-semibold text-warning hover:underline">See plans →</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reshape tools — shape the draft without spending a generation */}
          <AnimatePresence>
            {body.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 flex flex-wrap items-center gap-1.5 overflow-hidden"
              >
                <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">Reshape</span>
                <Reshape onClick={() => setBody(tighten(body))}>Tighten</Reshape>
                {platform === 'twitter' && <Reshape onClick={() => setBody(toThread(body))}>As a thread</Reshape>}
                <Reshape onClick={() => setBody(b => `${b.replace(/\n*📊[^\n]*/g, '').trim()}\n\n${statsLine(activeEvents)}`)}>+ Stats line</Reshape>
                <span className="ml-1 hidden text-[10px] italic text-muted sm:inline">free · no AI credit used</span>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={mode === 'manual'
              ? 'Your humanized post lands here — reads like you typed it yourself, because the facts are yours.'
              : `Your ${platform} post appears here. Generated from real events — then it's yours to edit.`}
            className="mt-3 min-h-[320px] flex-1 resize-none rounded-xl border border-line bg-white/[0.02] p-4 font-sans text-sm leading-relaxed placeholder:text-muted"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">{body.length} chars{platform === 'twitter' && body.length > 280 ? ' · thread territory' : ''}</span>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={copy} disabled={!body}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-secondary hover:border-line-hover hover:text-primary disabled:opacity-40">
                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={!body}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-secondary hover:border-line-hover hover:text-primary disabled:opacity-40">
                {saved ? <Check size={13} className="text-success" /> : <Save size={13} />} {saved ? 'Saved' : 'Save Draft'}
              </motion.button>
              {composeUrl(platform, body).url && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={copyAndOpen} disabled={!body}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-40">
                  {opened ? <Check size={13} /> : <ExternalLink size={13} />}
                  {opened ? 'Copied — paste & post' : 'Copy & open'}
                </motion.button>
              )}
            </div>
          </div>
          {composeUrl(platform, body).url && (
            <p className="mt-2 text-right text-[10px] text-muted">
              Copy & open drops you into the {PLATFORMS.find(p => p.key === platform)?.label} composer, post already on your clipboard.
            </p>
          )}
        </div>
      </div>
    </Page>
  )
}

// A local reshape chip — instant text transform, no AI call.
function Reshape({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="rounded-full border border-line px-3 py-1 text-[11.5px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent"
    >
      {children}
    </motion.button>
  )
}
