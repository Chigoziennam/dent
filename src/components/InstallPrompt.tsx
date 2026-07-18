import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Share, PlusSquare, Smartphone } from 'lucide-react'
import { useDent } from '../lib/store'

// ── Add to Home Screen — the app should live where real apps live ──
// Android/Chrome fires `beforeinstallprompt`; we stash it and offer a real
// one-tap Install. iOS Safari has no API, so we show the Share → Add to
// Home Screen steps. Never shown when already installed (standalone mode).

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Capture at module load — the event often fires before React mounts.
let deferredInstall: BIPEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredInstall = e as BIPEvent
    listeners.forEach(fn => fn())
  })
}

const DISMISS_KEY = 'shiplog-a2hs-dismissed'
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallPrompt() {
  const loggedIn = useDent(s => s.loggedIn)
  const [, bump] = useState(0)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    const fn = () => bump(n => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  if (!loggedIn || dismissed || isStandalone()) return null
  const ios = isIOS()
  if (!ios && !deferredInstall) return null // desktop/browser without install support

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }
  const install = async () => {
    if (!deferredInstall) return
    await deferredInstall.prompt()
    const { outcome } = await deferredInstall.userChoice
    if (outcome === 'accepted') deferredInstall = null
    dismiss()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 1.2 }}
        className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md md:bottom-6"
      >
        <div className="glass-strong flex items-start gap-3 rounded-2xl border border-accent/30 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Smartphone size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-primary">Put Super Dent X on your Home Screen</div>
            {ios ? (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-secondary">
                Tap <Share size={13} className="inline text-accent" /> <span className="font-medium">Share</span>, then
                <PlusSquare size={13} className="inline text-accent" /> <span className="font-medium">Add to Home Screen</span> — full-screen, faster, one tap away.
              </div>
            ) : (
              <div className="mt-1 text-xs leading-relaxed text-secondary">
                Installs like a real app — full-screen, faster, one tap from your home screen.
              </div>
            )}
            {!ios && (
              <button onClick={install}
                className="sheen mt-2.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white">
                Install app
              </button>
            )}
          </div>
          <button onClick={dismiss} aria-label="dismiss" className="rounded-lg p-1 text-muted hover:bg-white/5"><X size={14} /></button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
