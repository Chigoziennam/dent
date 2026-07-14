import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, Sun, Clock, Sparkles, PenLine, BarChart3, Trophy, Plug, Settings, Plus, ScrollText } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { CategoryPill } from './ui'

interface Item {
  group: string
  label: string
  icon?: typeof Sun
  action: () => void
  extra?: React.ReactNode
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const events = useShipLog(s => s.events)

  useEffect(() => { inputRef.current?.focus() }, [])

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => { navigate(path); onClose() }
    const nav: Item[] = [
      { group: 'Actions', label: 'Log what I built today', icon: Plus, action: go('/app/today') },
      { group: 'Actions', label: 'Generate tweet from this week', icon: Sparkles, action: go('/app/write') },
      { group: 'Actions', label: 'Add manual event', icon: Plus, action: go('/app/today?add=1') },
      { group: 'Navigation', label: 'Today', icon: Sun, action: go('/app/today') },
      { group: 'Navigation', label: 'Timeline', icon: Clock, action: go('/app/timeline') },
      { group: 'Navigation', label: 'This Week', icon: Sparkles, action: go('/app/week') },
      { group: 'Navigation', label: 'Write', icon: PenLine, action: go('/app/write') },
      { group: 'Navigation', label: 'Analytics', icon: BarChart3, action: go('/app/analytics') },
      { group: 'Navigation', label: 'Changelog', icon: ScrollText, action: go('/app/changelog') },
      { group: 'Navigation', label: 'Achievements', icon: Trophy, action: go('/app/achievements') },
      { group: 'Navigation', label: 'Integrations', icon: Plug, action: go('/app/integrations') },
      { group: 'Navigation', label: 'Settings', icon: Settings, action: go('/app/settings') },
    ]
    const q = query.trim().toLowerCase()
    if (!q) return nav
    const navHits = nav.filter(i => i.label.toLowerCase().includes(q))
    const eventHits: Item[] = events
      .filter(e => e.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map(e => ({
        group: 'Events',
        label: e.title,
        action: go('/app/timeline'),
        extra: <span className="ml-auto flex items-center gap-2"><CategoryPill category={e.category} /><span className="font-mono text-[10px] text-muted">{e.eventDate}</span></span>,
      }))
    return [...eventHits, ...navHits]
  }, [query, events, navigate, onClose])

  useEffect(() => { setIndex(0) }, [query])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); items[index]?.action() }
    if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm md:pt-[15vh]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="glass-strong flex h-dvh w-full flex-col overflow-hidden md:h-auto md:max-h-[60vh] md:w-[560px] md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search events, generate content..."
            className="flex-1 bg-transparent font-mono text-sm text-primary placeholder:text-muted"
          />
          <button onClick={onClose} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">esc</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">No results for “{query}”</div>}
          {items.map((item, i) => {
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            return (
              <div key={`${item.group}-${item.label}-${i}`}>
                {showGroup && <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{item.group}</div>}
                <button
                  onMouseEnter={() => setIndex(i)}
                  onClick={item.action}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] ${i === index ? 'bg-accent/15 text-primary' : 'text-secondary'}`}
                >
                  {item.icon && <item.icon size={15} className={i === index ? 'text-accent' : 'text-muted'} />}
                  <span className="truncate">{item.label}</span>
                  {item.extra}
                </button>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
