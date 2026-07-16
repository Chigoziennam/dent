import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek, addDays, parseISO } from 'date-fns'
import { Copy, RefreshCw, Send, Check, ExternalLink, Trophy } from 'lucide-react'
import { useShipLog, todayStr } from '../lib/store'
import { generateContent, composeUrl } from '../lib/ai'
import { TONE_META, CATEGORY_META, type ContentPlatform, type Tone, type EventCategory } from '../lib/types'
import { Page, GlassCard, CountUp, CategoryPill, SectionTitle, stagger } from '../components/ui'
import { Typewriter } from '../components/Typewriter'

const TABS: { key: ContentPlatform; label: string }[] = [
  { key: 'twitter', label: '🐦 Tweet' },
  { key: 'linkedin', label: '💼 LinkedIn' },
  { key: 'newsletter', label: '📰 Newsletter' },
]
const TONES = Object.keys(TONE_META) as Tone[]

export default function Week() {
  const { events, dailyLogs, profile, saveContent, publishChangelog } = useShipLog()
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd')), [weekStart])
  const weekEvents = useMemo(() => events.filter(e => days.includes(e.eventDate)), [events, days])
  const weekLogs = useMemo(() => dailyLogs.filter(l => days.includes(l.logDate)), [dailyLogs, days])

  const [selectedDay, setSelectedDay] = useState<string>(todayStr())
  const [tab, setTab] = useState<ContentPlatform>('twitter')
  const [tone, setTone] = useState<Tone>(profile.tone)
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({})
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const draftKey = `${tab}-${tone}`
  const draft = drafts[draftKey]

  const bumpAiUsage = useShipLog(s => s.bumpAiUsage)
  const generate = async () => {
    setGenerating(true)
    bumpAiUsage()
    const text = await generateContent({
      events: weekEvents, dailyLogs: weekLogs, platform: tab, tone,
      projectName: profile.projectName, projectTagline: profile.projectTagline,
    })
    setDrafts(d => ({ ...d, [draftKey]: text }))
    setGenerating(false)
  }

  const copy = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const saveDraft = () => {
    if (!draft) return
    saveContent({ platform: tab, tone, title: `Week of ${format(weekStart, 'MMM d')}`, body: draft, status: 'draft' })
  }

  const publish = () => {
    if (!draft) return
    publishChangelog({ versionTag: '', title: `Week of ${format(weekStart, 'MMM d, yyyy')}`, body: draft })
  }

  const kpis = [
    { label: 'Events Logged', value: weekEvents.length },
    { label: 'Commits', value: weekEvents.filter(e => e.category === 'commit').length },
    { label: 'Deploys', value: weekEvents.filter(e => e.category === 'deployment').length },
    { label: 'XP Earned', value: weekEvents.length * 10 + weekLogs.length * 25, prefix: '+' },
  ]
  const dayEvents = weekEvents.filter(e => e.eventDate === selectedDay)

  const bestDay = useMemo(() => {
    const counts = days.map(d => ({ date: d, count: weekEvents.filter(e => e.eventDate === d).length }))
    return counts.sort((a, b) => b.count - a.count)[0]
  }, [days, weekEvents])

  const catMix = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of weekEvents) m.set(e.category, (m.get(e.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [weekEvents])

  const copyAndOpen = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    const { url } = composeUrl(tab, draft)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const navigate = useNavigate()
  // Hand the draft to the full Writer for deeper editing
  const openInWriter = () => {
    if (draft) sessionStorage.setItem('shiplog-handoff', JSON.stringify({ body: draft, platform: tab, tone }))
    navigate('/app/write')
  }

  return (
    <Page>
      <motion.div initial="initial" animate="animate" variants={stagger}>
        {/* KPIs */}
        <motion.div variants={{ animate: { transition: { staggerChildren: 0.08 } } }} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map(k => (
            <GlassCard key={k.label} className="!p-4 text-center">
              <CountUp value={k.value} prefix={k.prefix ?? ''} className="text-2xl font-bold text-primary" />
              <div className="mt-0.5 text-xs text-secondary">{k.label}</div>
            </GlassCard>
          ))}
        </motion.div>

        {/* Best day + category mix */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <GlassCard className="!p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15">
                <Trophy size={18} className="text-warning" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Best day this week</div>
                {bestDay && bestDay.count > 0 ? (
                  <div className="text-sm font-semibold text-primary">
                    {format(parseISO(bestDay.date), 'EEEE')} — <span className="text-warning">{bestDay.count} ships</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted">The week is young. Claim it.</div>
                )}
              </div>
            </div>
          </GlassCard>
          <GlassCard className="!p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">What the week was made of</div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-white/5">
              {catMix.map(([cat, n], i) => (
                <motion.div
                  key={cat}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / Math.max(1, weekEvents.length)) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
                  style={{ background: CATEGORY_META[cat as EventCategory].color }}
                  title={`${CATEGORY_META[cat as EventCategory].label}: ${n}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {catMix.slice(0, 4).map(([cat, n]) => (
                <span key={cat} className="flex items-center gap-1.5 text-[10px] text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[cat as EventCategory].color }} />
                  {CATEGORY_META[cat as EventCategory].label} · {n}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Day nodes */}
        <GlassCard className="mt-4">
          <SectionTitle>Week Timeline</SectionTitle>
          <div className="flex items-end justify-between gap-1.5">
            {days.map(d => {
              const count = weekEvents.filter(e => e.eventDate === d).length
              const isFuture = d > todayStr()
              const active = selectedDay === d
              const max = Math.max(1, ...days.map(dd => weekEvents.filter(e => e.eventDate === dd).length))
              return (
                <button key={d} disabled={isFuture} onClick={() => setSelectedDay(d)} className="group flex flex-1 flex-col items-center gap-1.5 disabled:opacity-30">
                  <span className="font-mono text-[10px] text-muted">{count > 0 ? count : ''}</span>
                  <motion.div
                    initial={{ height: 6 }}
                    animate={{ height: 6 + (count / max) * 52 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                    className={`w-full max-w-10 rounded-t-lg transition-all ${active ? 'shadow-[0_0_20px_rgba(99,102,241,0.5)]' : ''}`}
                    style={{
                      background: active
                        ? 'linear-gradient(180deg, #ec4899, #6366f1)'
                        : count > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                    }}
                  />
                  <span className={`text-[11px] font-medium ${active ? 'text-primary' : 'text-secondary'}`}>{format(parseISO(d), 'EEE')}</span>
                  <span className={`text-[10px] ${d === todayStr() ? 'font-bold text-accent' : 'text-muted'}`}>{d === todayStr() ? 'Today' : format(parseISO(d), 'd')}</span>
                </button>
              )
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDay}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-4 space-y-2 border-t border-line pt-4"
            >
              {dayEvents.length === 0 && <p className="text-sm text-muted">No events on this day.</p>}
              {dayEvents.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 text-sm">
                  <CategoryPill category={e.category} />
                  <span className="truncate text-primary">{e.title}</span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </GlassCard>

        {/* AI content */}
        <GlassCard className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === t.key ? 'bg-accent/15 text-accent' : 'text-secondary hover:text-primary'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {TONES.map(t => (
                <button key={t} onClick={() => setTone(t)} title={TONE_META[t].hint}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-secondary'}`}>
                  {TONE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 min-h-[180px] rounded-xl border border-line bg-white/[0.02] p-4">
            {generating ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  ✨ ShipLog AI is writing from your {weekEvents.length} events…
                </motion.span>
              </div>
            ) : draft ? (
              <Typewriter text={draft} className="whitespace-pre-wrap text-sm leading-relaxed text-primary" />
            ) : (
              <p className="text-sm text-muted">Hit <span className="text-accent">Generate</span> and your week becomes a {tab === 'twitter' ? 'tweet' : tab} draft — in your {tone} voice.</p>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={generate} disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50">
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} /> {draft ? 'Regenerate' : 'Generate'}
            </motion.button>
            <ActionBtn onClick={copy} icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy'} disabled={!draft} />
            {composeUrl(tab, draft ?? '').url && <ActionBtn onClick={copyAndOpen} icon={ExternalLink} label="Copy & open" disabled={!draft} />}
            <ActionBtn onClick={saveDraft} icon={Send} label="Save Draft" disabled={!draft} />
            <ActionBtn onClick={openInWriter} icon={Send} label="Open in Writer" disabled={!draft} />
            <ActionBtn onClick={publish} icon={Send} label="Publish to Changelog" disabled={!draft} />
          </div>
        </GlassCard>
      </motion.div>
    </Page>
  )
}

function ActionBtn({ onClick, icon: Icon, label, disabled }: { onClick: () => void; icon: typeof Copy; label: string; disabled?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-secondary transition-colors hover:border-line-hover hover:text-primary disabled:opacity-40">
      <Icon size={13} /> {label}
    </motion.button>
  )
}
