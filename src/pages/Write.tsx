import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { subDays, format } from 'date-fns'
import { Sparkles, Copy, Save, Check, ChevronDown, Wand2, Lock } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { generateContent, humanize } from '../lib/ai'
import type { ContentPlatform, Tone } from '../lib/types'
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
const TONES: Tone[] = ['founder', 'technical', 'storytelling']
const RANGES = [
  { key: 7, label: 'This Week' },
  { key: 30, label: 'This Month' },
  { key: 90, label: 'All 90 Days' },
]

export default function Write() {
  const { events, dailyLogs, profile, saveContent, content } = useShipLog()
  const [mode, setMode] = useState<'ships' | 'manual'>('ships')
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

  const cutoff = format(subDays(new Date(), range), 'yyyy-MM-dd')
  const rangeEvents = useMemo(() => events.filter(e => e.eventDate >= cutoff), [events, cutoff])
  const rangeLogs = useMemo(() => dailyLogs.filter(l => l.logDate >= cutoff), [dailyLogs, cutoff])

  const pickPlatform = (p: { key: ContentPlatform; pro?: boolean }) => {
    setPlatform(p.key)
    if (p.pro) {
      setProNudge(true)
      setTimeout(() => setProNudge(false), 4000)
    }
  }

  const generate = async () => {
    setGenerating(true)
    const text = mode === 'manual'
      ? await humanize(raw, platform, tone, profile.projectName)
      : await generateContent({
          events: rangeEvents, dailyLogs: rangeLogs, platform, tone,
          projectName: profile.projectName, projectTagline: profile.projectTagline,
        })
    setBody(text)
    setGenerating(false)
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
          { key: 'manual', label: 'Raw notes → Human post', hint: 'You talk, it shapes — never sounds like AI', icon: Wand2 },
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
                <SectionTitle>Source Material · {rangeEvents.length} events</SectionTitle>
                <ChevronDown size={14} className={`text-muted transition-transform lg:hidden ${contextOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className={`space-y-2 ${contextOpen ? '' : 'hidden lg:block'}`}>
                {rangeEvents.slice(0, 14).map(e => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                    <CategoryPill category={e.category} />
                    <span className="truncate text-xs text-secondary">{e.title}</span>
                  </div>
                ))}
                {rangeEvents.length > 14 && <div className="pt-1 text-center font-mono text-[11px] text-muted">+ {rangeEvents.length - 14} more feeding the AI</div>}
              </div>
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
              <button key={t} onClick={() => setTone(t)}
                className={`rounded-full border px-3 py-1 text-[11.5px] font-medium capitalize transition-colors ${tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
                {t}
              </button>
            ))}
            {mode === 'ships' && <>
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
            disabled={generating || (mode === 'manual' && !raw.trim())}
            className="sheen mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)] disabled:opacity-60"
          >
            {mode === 'manual' ? <Wand2 size={15} className={generating ? 'animate-pulse' : ''} /> : <Sparkles size={15} className={generating ? 'animate-pulse' : ''} />}
            {generating ? 'Writing…' : mode === 'manual' ? 'Make it human' : 'Generate ✨'}
          </motion.button>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={mode === 'manual'
              ? 'Your humanized post lands here — reads like you typed it yourself, because the facts are yours.'
              : `Your ${platform} post appears here. Generated from real events — then it's yours to edit.`}
            className="mt-4 min-h-[320px] flex-1 resize-none rounded-xl border border-line bg-white/[0.02] p-4 font-sans text-sm leading-relaxed placeholder:text-muted"
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
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
