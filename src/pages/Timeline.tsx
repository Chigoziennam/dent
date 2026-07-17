import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isToday, isYesterday, parseISO, subDays } from 'date-fns'
import { Pin, Trash2, Sparkles, History } from 'lucide-react'
import { useDent } from '../lib/store'
import { SOURCE_LABEL, type EventCategory } from '../lib/types'
import { Page, CategoryPill, CountUp } from '../components/ui'

const FILTERS: { key: EventCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'commit', label: 'Commits' },
  { key: 'deployment', label: 'Deploys' },
  { key: 'feature', label: 'Features' },
  { key: 'bugfix', label: 'Bugs' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'milestone', label: 'Milestones' },
  { key: 'learning', label: 'Learnings' },
]

function dateLabel(d: string): string {
  const date = parseISO(d)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d')
}

export default function Timeline() {
  const { events, togglePin, deleteEvent } = useDent()
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')
  const [limit, setLimit] = useState(40)
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(
    () => events
      .filter(e => filter === 'all' || e.category === filter)
      .sort((a, b) => b.eventTime.localeCompare(a.eventTime)),
    [events, filter]
  )
  const pinned = filtered.filter(e => e.isPinned)
  const visible = filtered.slice(0, limit)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visible>()
    for (const e of visible) {
      const arr = map.get(e.eventDate) ?? []
      arr.push(e)
      map.set(e.eventDate, arr)
    }
    return [...map.entries()]
  }, [visible])

  const thisWeek = useMemo(() => {
    const cutoff = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    return events.filter(e => e.eventDate >= cutoff).length
  }, [events])
  const lastWeek = useMemo(() => {
    const from = format(subDays(new Date(), 14), 'yyyy-MM-dd')
    const to = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    return events.filter(e => e.eventDate >= from && e.eventDate < to).length
  }, [events])
  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null

  // Memory hook: what were you shipping a month ago today?
  const onThisDay = useMemo(() => {
    const d = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    return { date: d, events: events.filter(e => e.eventDate === d).slice(0, 2) }
  }, [events])

  return (
    <Page>
      {/* The story so far */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="glass !rounded-2xl p-3.5 text-center">
          <CountUp value={events.length} className="text-xl font-bold text-primary" />
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">total ships</div>
        </div>
        <div className="glass !rounded-2xl p-3.5 text-center">
          <CountUp value={thisWeek} className="text-xl font-bold text-primary" />
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
            this week {delta !== null && <span className={delta >= 0 ? 'text-success' : 'text-warning'}>{delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}%</span>}
          </div>
        </div>
        <div className="glass !rounded-2xl p-3.5 text-center">
          <CountUp value={pinned.length} className="text-xl font-bold text-primary" />
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">pinned moments</div>
        </div>
      </div>

      {/* Memory hook */}
      {onThisDay.events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-white/[0.02] p-4"
        >
          <History size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">One month ago today</div>
            {onThisDay.events.map(e => (
              <div key={e.id} className="mt-1 truncate text-[13px] text-secondary">· {e.title}</div>
            ))}
            <div className="mt-1 text-[11px] text-muted">Look how far the project has come since.</div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${filter === f.key ? 'bg-accent text-white shadow-[0_0_16px_rgba(99,102,241,0.3)]' : 'border border-line text-secondary hover:border-line-hover hover:text-primary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-warning">📌 Pinned</div>
          <div className="space-y-2">
            {pinned.map(e => (
              <div key={e.id} className="glass border-l-2 !border-l-warning/70 p-4">
                <EventRow event={e} onPin={() => togglePin(e.id)} onDelete={() => deleteEvent(e.id)} expanded={expanded === e.id} onExpand={() => setExpanded(x => x === e.id ? null : e.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative mt-6 pl-5">
        <div className="absolute inset-y-0 left-1 w-px bg-accent/20" />
        <AnimatePresence mode="popLayout">
          {grouped.map(([date, dayEvents]) => (
            <motion.div
              key={`${filter}-${date}`}
              layout
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-7"
            >
              <div className="relative mb-3">
                <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                <span className="text-sm font-semibold text-primary">{dateLabel(date)}</span>
                <span className="ml-2 font-mono text-[11px] text-muted">{dayEvents.length} events</span>
              </div>
              <div className="space-y-2">
                {dayEvents.map(e => (
                  <motion.div
                    key={e.id}
                    whileHover={{ y: -1, borderColor: 'rgba(255,255,255,0.12)' }}
                    className="glass group p-4"
                    style={e.category === 'milestone' ? { borderColor: 'rgba(252,211,77,0.35)', boxShadow: '0 0 24px rgba(252,211,77,0.12), 0 8px 32px rgba(0,0,0,0.4)' } : undefined}
                  >
                    <EventRow event={e} onPin={() => togglePin(e.id)} onDelete={() => deleteEvent(e.id)} expanded={expanded === e.id} onExpand={() => setExpanded(x => x === e.id ? null : e.id)} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {visible.length < filtered.length && (
          <button
            onClick={() => setLimit(l => l + 40)}
            className="mb-6 w-full rounded-xl border border-line py-3 text-sm font-medium text-secondary transition-colors hover:border-line-hover hover:text-primary"
          >
            Load more · {filtered.length - visible.length} remaining
          </button>
        )}
      </div>

      {/* Turn history into content */}
      <Link to="/app/write" className="sheen mt-2 flex items-center justify-center gap-2 rounded-2xl bg-accent/90 py-3.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)]">
        <Sparkles size={15} /> This timeline is content. Turn it into a post →
      </Link>
    </Page>
  )
}

function EventRow({ event: e, onPin, onDelete, expanded, onExpand }: {
  event: ReturnType<typeof useDent.getState>['events'][number]
  onPin: () => void; onDelete: () => void; expanded: boolean; onExpand: () => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <CategoryPill category={e.category} />
        <span className="font-mono text-[10px] text-muted">{SOURCE_LABEL[e.source]} · {format(parseISO(e.eventTime), 'HH:mm')}</span>
        <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
          <button onClick={onPin} className={`rounded p-1.5 hover:bg-white/5 ${e.isPinned ? 'text-warning' : 'text-muted'}`}><Pin size={13} /></button>
          <button onClick={onDelete} className="rounded p-1.5 text-muted hover:bg-white/5 hover:text-danger"><Trash2 size={13} /></button>
        </div>
      </div>
      <button onClick={onExpand} className="mt-1.5 block w-full text-left text-sm font-medium text-primary">
        {e.title}
      </button>
      <AnimatePresence>
        {expanded && e.description && (
          <motion.p
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-xs leading-relaxed text-secondary"
          >
            {e.description}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
