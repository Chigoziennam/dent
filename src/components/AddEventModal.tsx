import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, RotateCw, Link2 } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { CATEGORY_META, type EventCategory } from '../lib/types'

const QUICK_CATS: EventCategory[] = ['feature', 'commit', 'bugfix', 'deployment', 'revenue', 'customer', 'milestone', 'learning', 'idea', 'design']

const EFFORT = [
  { key: 'quick', label: 'Quick win', hint: '< 30 min' },
  { key: 'session', label: 'Solid session', hint: '1–3 hrs' },
  { key: 'deep', label: 'Deep work', hint: 'half day+' },
] as const

export function AddEventModal({ onClose }: { onClose: () => void }) {
  const { addEvent, events } = useShipLog()
  const [tab, setTab] = useState<'new' | 'continue'>('new')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [effort, setEffort] = useState<typeof EFFORT[number]['key'] | null>(null)
  const [category, setCategory] = useState<EventCategory>('feature')

  // Ongoing work: same title shipped across multiple days = a series.
  // People push the same project day after day — honor that instead of
  // pretending every ship is brand new.
  const ongoing = useMemo(() => {
    const map = new Map<string, { title: string; category: EventCategory; days: Set<string>; lastDate: string }>()
    for (const e of events) {
      const key = e.title.replace(/\s*—\s*day \d+$/i, '').trim().toLowerCase()
      const entry = map.get(key)
      if (entry) {
        entry.days.add(e.eventDate)
        if (e.eventDate > entry.lastDate) entry.lastDate = e.eventDate
      } else {
        map.set(key, { title: e.title.replace(/\s*—\s*day \d+$/i, '').trim(), category: e.category, days: new Set([e.eventDate]), lastDate: e.eventDate })
      }
    }
    return [...map.values()]
      .filter(v => v.days.size >= 1)
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
      .slice(0, 6)
  }, [events])

  const continueWork = (o: { title: string; category: EventCategory; days: Set<string> }) => {
    setTitle(`${o.title} — day ${o.days.size + 1}`)
    setCategory(o.category)
    setTab('new')
  }

  const submit = () => {
    if (!title.trim()) return
    const parts: string[] = []
    if (description.trim()) parts.push(description.trim())
    if (effort) parts.push(`Effort: ${EFFORT.find(e => e.key === effort)!.label}`)
    if (link.trim()) parts.push(`Link: ${link.trim()}`)
    addEvent({ title: title.trim(), category, description: parts.join('\n') || undefined })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="glass-strong w-full max-w-md rounded-t-3xl p-6 md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Log a ship</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/5"><X size={16} /></button>
        </div>

        {/* New vs Continue */}
        <div className="mt-3.5 flex rounded-xl border border-line bg-white/[0.02] p-1">
          {([
            { key: 'new', label: 'New ship', icon: Plus },
            { key: 'continue', label: 'Continue ongoing', icon: RotateCw },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-semibold transition-colors ${tab === t.key ? 'text-primary' : 'text-muted'}`}>
              {tab === t.key && (
                <motion.div layoutId="ship-tab" className="absolute inset-0 rounded-lg bg-accent/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <t.icon size={13} className={`relative ${tab === t.key ? 'text-accent' : ''}`} />
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'continue' ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs leading-relaxed text-muted">
              The projects you keep showing up for. Tap one — the day counter keeps your story continuous.
            </p>
            {ongoing.length === 0 && <p className="py-3 text-center text-sm text-muted">Log a few ships first — your ongoing work shows up here.</p>}
            {ongoing.map(o => (
              <button key={o.title} onClick={() => continueWork(o)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-3 text-left transition-colors hover:border-accent/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
                  style={{ color: CATEGORY_META[o.category].color, background: CATEGORY_META[o.category].bg }}>
                  d{o.days.size}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-primary">{o.title}</span>
                  <span className="text-[11px] text-muted">{o.days.size === 1 ? 'shipped once' : `${o.days.size} days of work`} · last {o.lastDate}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-accent">Day {o.days.size + 1} →</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {QUICK_CATS.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all"
                  style={category === c
                    ? { color: CATEGORY_META[c].color, background: CATEGORY_META[c].bg, borderColor: CATEGORY_META[c].color }
                    : { color: '#8888a0', borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>

            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="What did you ship?"
              className="mt-4 w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Details — what changed, why it matters (optional)"
              rows={2}
              className="mt-2.5 w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
            />

            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3.5">
              <Link2 size={13} className="shrink-0 text-muted" />
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="Proof link — PR, deploy URL, screenshot (optional)"
                className="w-full bg-transparent py-3 text-sm placeholder:text-muted"
              />
            </div>

            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-medium text-secondary">How big was it?</div>
              <div className="flex gap-1.5">
                {EFFORT.map(e => (
                  <button key={e.key} onClick={() => setEffort(effort === e.key ? null : e.key)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-center transition-all ${effort === e.key ? 'border-accent/60 bg-accent/10' : 'border-line hover:border-line-hover'}`}>
                    <div className={`text-[11.5px] font-semibold ${effort === e.key ? 'text-accent' : 'text-secondary'}`}>{e.label}</div>
                    <div className="text-[9.5px] text-muted">{e.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submit}
              disabled={!title.trim()}
              className="sheen mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-opacity disabled:opacity-40"
            >
              Ship it · +10 XP
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
