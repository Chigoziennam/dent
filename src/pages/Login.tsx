import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Github, Mail, ArrowRight } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { Orbs, Logo } from '../components/ui'

export default function Login() {
  const login = useShipLog(s => s.login)
  const navigate = useNavigate()

  const enter = () => {
    login()
    navigate('/app/today')
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-base px-5">
      <Orbs />
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
          onClick={enter}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
        >
          <Github size={17} /> Continue with GitHub
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={enter}
          className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line px-4 py-3 text-sm font-medium text-secondary transition-colors hover:border-line-hover hover:text-primary"
        >
          <Mail size={16} /> Magic link
        </motion.button>

        <button onClick={enter} className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-accent">
          Just exploring? Enter the live demo <ArrowRight size={12} />
        </button>
        <p className="mt-5 text-[10px] leading-relaxed text-muted">
          Demo build — auth is simulated. Supabase OAuth lands with the production release.
        </p>
      </motion.div>
    </div>
  )
}
