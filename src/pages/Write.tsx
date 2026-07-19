import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { subDays, format } from 'date-fns'
import { Sparkles, Copy, Save, Check, ChevronDown, Wand2, Lock, Atom, ExternalLink } from 'lucide-react'
import { useDent } from '../lib/store'
import { generateContent, humanize, fuse, composeUrl, tighten, toThread, statsLine } from '../lib/ai'
import { repoOf } from '../lib/github'
import { entitlementsFor, platformAllowed } from '../lib/plan'
import { TONE_META, type ContentPlatform, type Tone } from '../lib/types'
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
  const { events, dailyLogs, profile, saveContent, content } = useDent()
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
  const [contextOpen, setContextOpen] = useState(false)
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
  const rangeEvents = useMemo(
    () => inRange.filter(e => !focusRepo || e.source !== 'github' || repoOf(e) === focusRepo),
    [inRange, focusRepo],
  )
  // Hand-picking: every ship in range is IN by default; tap one to leave it
  // out. This is how you talk about exactly the commits you choose — the
  // site offers them, you decide.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  useEffect(() => { setExcluded(new Set()) }, [range, focusRepo, source])
  const toggleShip = (id: string) => setExcluded(prev => {
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
    const filtered = rangeEvents.filter(e =>
      source === 'all' ? true : source === 'github' ? e.source === 'github' : e.source !== 'github')
    return [...filtered.filter(e => e.source !== 'github'), ...filtered.filter(e => e.source === 'github')]
  }, [rangeEvents, source])

  const activeEvents = useMemo(() => sourceEvents.filter(e => !excluded.has(e.id)), [sourceEvents, excluded])

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
        : "Every ship is excluded — tap some back on so there's a story to tell.")
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

  return (
    <Page className="max-w-6xl">
      {/* Mode switch: AI from ships vs. human-first manual */}
      <div className="mb-4 flex rounded-2xl border border-line bg-white/[0.02] p-1">
        {([
          { key: 'ships', label: 'From my ships', hint: 'AI drafts from your logged events', icon: Sparkles },
          { key: 'manual', label: 'Raw notes → Human', hint: 'You talk, it shapes — never sounds like AI', icon: Wand2 },
          { key: 'fusion', label: 'Fusion', hint: 'Pick ships + your state = the ultimate post', icon: Atom },
        ] as const).map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`relative flex-1 rounded-xl px-4 py-2.5 text-left transition-colors ${mode === m.key ? 'text-primary' : 'text-muted hover:text-secondary'}`}
          >
            {mode === m.key && (
              <motion.div layoutId="write-mode" className="absolute inset-0 rounded-xl bg-accent/15 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <div className="relative flex items-center gap-2 text-[13.5px] font-semibold"><m.icon size={14} className={mode === m.key ? 'text-accent' : ''} /> {m.label}</div>
            <div className="relative mt-0.5 hidden text-[11px] text-muted sm:block">{m.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Context panel */}
        <div className="lg:col-span-2">
          {mode === 'ships' ? (
            <div className="glass p-5">
              <button onClick={() => setContextOpen(o => !o)} className="flex w-full items-center justify-between lg:pointer-events-none">
                <SectionTitle>Source Material · {activeEvents.length}{excluded.size > 0 ? ` of ${rangeEvents.length}` : ''} events</SectionTitle>
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
                {/* Untapping 30 ships one at a time to write about two is not
                    a workflow. Bulk controls make the narrow post as cheap as
                    the wide one. */}
                <div className="flex items-center justify-between gap-2 pb-1">
                  <span className="text-[10.5px] text-muted">Tap a ship to leave it out — the post only uses what&apos;s lit.</span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setExcluded(new Set())}
                      disabled={excluded.size === 0}
                      className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                      Use all
                    </button>
                    <button type="button" onClick={() => setExcluded(new Set(sourceEvents.map(e => e.id)))}
                      disabled={excluded.size === sourceEvents.length}
                      className="rounded-md border border-line px-2 py-0.5 text-[10px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-35">
                      Clear
                    </button>
                  </span>
                </div>
                {sourceEvents.slice(0, 40).map(e => {
                  const out = excluded.has(e.id)
                  return (
                    <button
                      key={e.id} type="button" onClick={() => toggleShip(e.id)}
                      aria-pressed={!out}
                      aria-label={`${out ? 'Include' : 'Leave out'} ${e.title}`}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${out ? 'border-line/50 bg-transparent opacity-40' : 'border-line bg-white/[0.02]'}`}
                    >
                      <CategoryPill category={e.category} />
                      <span className={`truncate text-xs ${out ? 'text-muted line-through' : 'text-secondary'}`}>{e.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted">
                        {e.source === 'github' ? (repoOf(e) ?? 'github') : 'yours'}
                      </span>
                    </button>
                  )
                })}
                {sourceEvents.length > 40 && <div className="pt-1 text-center font-mono text-[11px] text-muted">+ {sourceEvents.length - 40} more feeding the AI</div>}
              </div>
            </div>
          ) : mode === 'fusion' ? (
            <div className="glass flex flex-col p-5">
              <SectionTitle>Step 1 · Pick your ships</SectionTitle>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-xs leading-relaxed text-muted">
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
              <div className="no-scrollbar max-h-56 space-y-1.5 overflow-y-auto pr-1">
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
                      <CategoryPill category={e.category} />
                      <span className="truncate text-xs text-secondary">{e.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted">
                        {e.source === 'github' ? (repoOf(e) ?? 'github') : 'yours'}
                      </span>
                    </button>
                  )
                })}
              </div>
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
        <div className="glass flex flex-col p-5 lg:col-span-3">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {PLATFORMS.map(p => (
              <button key={p.key} onClick={() => pickPlatform(p)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${platform === p.key ? 'bg-accent/15 text-accent' : 'text-secondary hover:text-primary'}`}>
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
