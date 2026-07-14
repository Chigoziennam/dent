import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { CATEGORY_META, type EventCategory } from '../lib/types'

const QUICK_CATS: EventCategory[] = ['feature', 'commit', 'bugfix', 'deployment', 'revenue', 'customer', 'milestone', 'learning', 'idea', 'design']

export function AddEventModal({ onClose }: { onClose: () => void }) {
  const addEvent = useShipLog(s => s.addEvent)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<EventCategory>('feature')

  const submit = () => {
    if (!title.trim()) return
    addEvent({ title: title.trim(), category, description: description.trim() || undefined })
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
          placeholder="Details (optional)"
          rows={3}
          className="mt-2.5 w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
        />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!title.trim()}
          className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-opacity disabled:opacity-40"
        >
          Ship it · +10 XP
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
