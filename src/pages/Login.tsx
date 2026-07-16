import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Github, Mail, ArrowRight, Check } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { supabase, supabaseReady, signInWithGitHub } from '../lib/supabase'
import { SpaceBackdrop, Logo } from '../components/ui'

export default function Login() {
  const login = useShipLog(s => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enterDemo = () => {
    login()
    navigate('/app/today')
  }

  // Real auth when Supabase is configured; graceful demo otherwise
  const github = async () => {
    if (!supabaseReady) return enterDemo()
    setBusy(true)
    const { error } = await signInWithGitHub()
    if (error) { setError(error.message); setBusy(false) }
    // on success the browser redirects to GitHub
  }

  const magicLink = async () => {
    if (!supabaseReady || !email.trim()) return enterDemo()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/app/today` },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setLinkSent(true)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-base px-5">
      <SpaceBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass-strong relative z-10 w-full max-w-sm p-8 text-center"
      >
        <div className="flex justify-center"><Logo size={44} /></div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Welcome to ShipLog</h1>
        <p className="mt-1.5 text-sm text-secondary">Your builder's journal, on autopilot.</p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={github}
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          <Github size={17} /> Continue with GitHub
        </motion.button>

        {linkSent ? (
          <div className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            <Check size={15} /> Magic link sent — check your inbox
          </div>
        ) : (
          <div className="mt-2.5 flex gap-2">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && magicLink()}
              type="email"
              placeholder="you@buildsthings.com"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={magicLink}
              disabled={busy || (supabaseReady && !email.trim())}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-medium text-secondary transition-colors hover:border-accent/50 hover:text-primary disabled:opacity-50"
            >
              <Mail size={14} /> Link
            </motion.button>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <button onClick={enterDemo} className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-accent">
          Just exploring? Enter the live demo <ArrowRight size={12} />
        </button>
        <p className="mt-5 text-[10px] leading-relaxed text-muted">
          {supabaseReady
            ? 'Auth by Supabase — GitHub OAuth or passwordless email. No passwords stored, ever.'
            : 'Demo build — add Supabase keys to .env for real sign-in.'}
        </p>
      </motion.div>
    </div>
  )
}
