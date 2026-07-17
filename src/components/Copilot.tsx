import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles } from 'lucide-react'
import { useDent } from '../lib/store'
import { copilotAnswer, copilotBriefing, aiMode, SHIPPER_QUOTES } from '../lib/ai'
import { AICore } from './ui'

interface Msg { role: 'user' | 'copilot'; text: string }

const QUICK = ['How\'s my week?', 'When did I fix auth?', 'Motivate me', 'What should I ship next?']

export function Copilot() {
  const { events, dailyLogs, profile } = useDent()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [quoteIdx, setQuoteIdx] = useState(0)

  // Rotating shipper wisdom on the closed bubble's tooltip + panel header
  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % SHIPPER_QUOTES.length), 20_000)
    return () => clearInterval(t)
  }, [])

  // AUTOMATED: the co-pilot speaks first. On first open it reads the log
  // and delivers a briefing — no question needed. Runs once per session.
  const briefed = useRef(false)
  useEffect(() => {
    if (!open || briefed.current || msgs.length > 0) return
    briefed.current = true
    setThinking(true)
    copilotBriefing({
      events, dailyLogs,
      streak: profile.streakCurrent,
      projectName: profile.projectName,
      displayName: profile.displayName,
    }).then(text => {
      setMsgs(m => (m.length === 0 ? [{ role: 'copilot', text }] : m))
      setThinking(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, thinking])

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || thinking) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: question }])
    setThinking(true)
    const text = await copilotAnswer(question, {
      events, dailyLogs,
      streak: profile.streakCurrent,
      projectName: profile.projectName,
      displayName: profile.displayName,
    })
    setMsgs(m => [...m, { role: 'copilot', text }])
    setThinking(false)
  }

  const quote = SHIPPER_QUOTES[quoteIdx]

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.92 }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="fixed bottom-24 right-4 z-40 flex h-13 w-13 items-center justify-center rounded-2xl md:bottom-6 md:right-6"
        style={{
          height: 52, width: 52,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 0 32px rgba(99,102,241,0.55), 0 8px 24px rgba(0,0,0,0.4)',
        }}
        aria-label="Open co-pilot"
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="flex items-center justify-center">
          {open ? <X size={20} className="text-white" /> : <AICore size={30} />}
        </motion.span>
        {/* attention ping until the first briefing is read */}
        {!open && !briefed.current && (
          <>
            <motion.span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-success"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-success"
              animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="glass-strong fixed bottom-40 right-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden md:bottom-24 md:right-6"
            style={{ height: 'min(520px, 65dvh)' }}
          >
            {/* Header */}
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20"><AICore size={22} color="#a5b4fc" /></span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">Co-pilot</div>
                  <div className="text-[10px] text-muted">
                    {aiMode() === 'local'
                      ? `local brain · knows all ${events.length} ships`
                      : `live AI · has read all ${events.length} of your ships`}
                  </div>
                </div>
                <span
                  className="ml-auto flex h-2 w-2 rounded-full"
                  title={aiMode() === 'n8n' ? 'Wired to your n8n brain' : aiMode() === 'direct' ? 'Direct Claude API' : 'Offline engine — set VITE_N8N_WEBHOOK_BASE to go live'}
                  style={aiMode() === 'local'
                    ? { background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.8)' }
                    : { background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.8)' }}
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={quoteIdx}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="mt-2 text-[10.5px] italic leading-snug text-muted"
                >
                  “{quote.text}” — {quote.who}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-auto bg-accent text-white'
                      : 'border border-line bg-white/[0.03] text-secondary'
                  }`}
                >
                  {m.text}
                </motion.div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                  {msgs.length === 0 && <span className="ml-1 text-[10.5px] text-muted">reading your log…</span>}
                </div>
              )}
              {/* quick prompts stay visible under the opening briefing */}
              {!thinking && msgs.length <= 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK.map(qk => (
                    <button key={qk} onClick={() => ask(qk)}
                      className="rounded-full border border-line px-2.5 py-1.5 text-[11px] text-secondary transition-colors hover:border-accent/50 hover:text-accent">
                      {qk}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2 border-t border-line p-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask(input)}
                placeholder="Ask your log anything…"
                className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-[13px] placeholder:text-muted"
              />
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => ask(input)}
                disabled={!input.trim() || thinking}
                className="flex w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] disabled:opacity-40"
              >
                {thinking ? <Sparkles size={15} className="animate-pulse" /> : <Send size={15} />}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
