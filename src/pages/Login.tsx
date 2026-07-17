import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Mail, ArrowRight, Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useDent } from '../lib/store'
import { supabase, supabaseReady } from '../lib/supabase'
import { SpaceBackdrop, Logo } from '../components/ui'

type Mode = 'signin' | 'signup'

export default function Login() {
  const login = useDent(s => s.login)
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const enterDemo = () => {
    login()
    navigate('/app/today')
  }

  const friendly = (msg: string): string => {
    if (/provider is not enabled/i.test(msg)) return 'That sign-in method isn’t switched on yet — use email for now.'
    if (/rate limit/i.test(msg)) return 'Too many emails sent — Supabase’s built-in mailer is limited. Try again in an hour.'
    if (/invalid login credentials/i.test(msg)) return 'Wrong email or password. Or did you sign up with a different method?'
    if (/already registered/i.test(msg)) return 'That email already has an account — sign in instead.'
    return msg
  }

  const oauth = async (provider: 'github' | 'google' | 'apple') => {
    if (!supabaseReady) return enterDemo()
    setBusy(true); setError(null)
    const { error } = await supabase!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/app/today` },
    })
    if (error) { setError(friendly(error.message)); setBusy(false) }
  }

  const submit = async () => {
    if (!supabaseReady) return enterDemo()
    if (!email.trim() || !password) return
    setBusy(true); setError(null); setNotice(null)
    if (mode === 'signup') {
      const { error } = await supabase!.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${location.origin}/app/today` },
      })
      setBusy(false)
      if (error) setError(friendly(error.message))
      else setNotice('Account created — check your inbox to confirm your email, then sign in.')
    } else {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      if (error) setError(friendly(error.message))
      else { login(); navigate('/app/today') }
    }
  }

  const magicLink = async () => {
    if (!supabaseReady) return enterDemo()
    if (!email.trim()) { setError('Type your email first, then tap the magic link.'); return }
    setBusy(true); setError(null)
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/app/today` },
    })
    setBusy(false)
    if (error) setError(friendly(error.message))
    else setNotice('Magic link sent — check your inbox (and spam, the first time).')
  }

  const forgot = async () => {
    if (!supabaseReady || !email.trim()) { setError('Type your email first.'); return }
    setBusy(true)
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/app/settings` })
    setBusy(false)
    if (error) setError(friendly(error.message))
    else setNotice('Password reset email sent.')
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-base px-5 py-8">
      <SpaceBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass-strong relative z-10 w-full max-w-sm p-7"
      >
        <div className="flex justify-center"><Logo size={42} /></div>
        <h1 className="mt-3 text-center text-2xl font-bold tracking-tight">
          {mode === 'signin' ? 'Welcome back, builder' : 'Start your log'}
        </h1>
        <p className="mt-1 text-center text-sm text-secondary">
          {mode === 'signin' ? 'The log missed you.' : 'Free forever. Your work, remembered.'}
        </p>

        {/* Mode switch */}
        <div className="mt-5 flex rounded-xl border border-line bg-white/[0.02] p-1">
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null); setNotice(null) }}
              className={`relative flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === m ? 'text-primary' : 'text-muted'}`}>
              {mode === m && (
                <motion.div layoutId="auth-tab" className="absolute inset-0 rounded-lg bg-accent/15"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative">{m === 'signin' ? 'Sign in' : 'Create account'}</span>
            </button>
          ))}
        </div>

        {/* OAuth row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => oauth('github')} disabled={busy}
            className="flex items-center justify-center rounded-xl border border-line bg-white/[0.03] py-3 text-primary transition-colors hover:border-line-hover disabled:opacity-50"
            title="Continue with GitHub">
            <Github size={18} />
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => oauth('google')} disabled={busy}
            className="flex items-center justify-center rounded-xl border border-line bg-white/[0.03] py-3 transition-colors hover:border-line-hover disabled:opacity-50"
            title="Continue with Google">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => oauth('apple')} disabled={busy}
            className="flex items-center justify-center rounded-xl border border-line bg-white/[0.03] py-3 text-primary transition-colors hover:border-line-hover disabled:opacity-50"
            title="Continue with Apple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
          </motion.button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" /><span className="text-[10px] uppercase tracking-widest text-muted">or with email</span><div className="h-px flex-1 bg-line" />
        </div>

        {/* Email + password */}
        <div className="space-y-2.5">
          <input
            value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email"
            placeholder="you@buildsthings.com"
            className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-sm placeholder:text-muted"
          />
          <div className="relative">
            <input
              value={password} onChange={e => setPassword(e.target.value)}
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder={mode === 'signup' ? 'Choose a password (8+ chars)' : 'Password'}
              className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 pr-11 text-sm placeholder:text-muted"
            />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <motion.button
            type="button" whileTap={{ scale: 0.97 }} onClick={submit}
            disabled={busy || !email.trim() || password.length < (mode === 'signup' ? 8 : 1)}
            className="sheen flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.35)] disabled:opacity-50"
          >
            {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Create my account'}
          </motion.button>

          <div className="flex items-center justify-between text-[11.5px]">
            <button type="button" onClick={magicLink} className="flex items-center gap-1 text-muted transition-colors hover:text-accent">
              <Mail size={11} /> Email me a magic link instead
            </button>
            {mode === 'signin' && (
              <button type="button" onClick={forgot} className="text-muted transition-colors hover:text-accent">
                Forgot password?
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </motion.p>
          )}
          {notice && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-start gap-1.5 overflow-hidden rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <Check size={13} className="mt-0.5 shrink-0" /> {notice}
            </motion.p>
          )}
        </AnimatePresence>

        <button type="button" onClick={enterDemo} className="mt-5 flex w-full items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-accent">
          <Sparkles size={11} /> Just exploring? Enter the live demo <ArrowRight size={12} />
        </button>
        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
          {supabaseReady
            ? 'Secured by Supabase Auth. Passwords are hashed — we never see them.'
            : 'Demo build — add Supabase keys to .env for real accounts.'}
        </p>
      </motion.div>
    </div>
  )
}
