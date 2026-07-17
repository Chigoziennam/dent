import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Clock, PenLine, BarChart3, ScrollText, Trophy, Plug, Settings,
  Search, ChevronsLeft, ChevronsRight, User, Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { useDent } from '../lib/store'
import { Logo, StreakBadge, SpaceBackdrop, AnimatedAvatar } from './ui'
import { CommandPalette } from './CommandPalette'
import { AchievementToast } from './AchievementToast'
import { Copilot } from './Copilot'

const NAV = [
  { to: '/app/today', label: 'Today', icon: Sun },
  { to: '/app/timeline', label: 'Timeline', icon: Clock },
  { to: '/app/week', label: 'This Week', icon: Sparkles },
  { to: '/app/write', label: 'Write', icon: PenLine },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/changelog', label: 'Changelog', icon: ScrollText },
  { to: '/app/achievements', label: 'Achievements', icon: Trophy },
]
const NAV2 = [
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
const MOBILE_NAV = [
  { to: '/app/today', label: 'Today', icon: Sun },
  { to: '/app/timeline', label: 'Timeline', icon: Clock },
  { to: '/app/week', label: 'Week', icon: Sparkles },
  { to: '/app/write', label: 'Write', icon: PenLine },
  { to: '/app/settings', label: 'You', icon: User },
]

export default function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const profile = useDent(s => s.profile)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pageTitle = [...NAV, ...NAV2].find(n => location.pathname.startsWith(n.to))?.label ?? 'Dent'

  return (
    <div className="flex min-h-dvh bg-base">
      {/* The whole cockpit floats in space */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <SpaceBackdrop withFloor={false} />
      </div>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/50 md:flex"
      >
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-2">
          <button onClick={() => navigate('/app/today')} className="shrink-0"><Logo size={30} /></button>
          {!collapsed && <span className="text-[15px] font-bold tracking-tight">Dent</span>}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto rounded-md p-1 text-muted hover:bg-white/5 hover:text-secondary"
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-2 text-[13px] text-muted transition-colors hover:border-line-hover hover:text-secondary"
        >
          <Search size={14} />
          {!collapsed && <><span>Search</span><kbd className="ml-auto rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd></>}
        </button>

        <motion.nav
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.03 } } }}
          className="mt-4 flex flex-1 flex-col gap-0.5 px-3"
        >
          {NAV.map(item => <SideLink key={item.to} {...item} collapsed={collapsed} />)}
          {!collapsed && <div className="mt-4 mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted">Workspace</div>}
          {collapsed && <div className="my-3 mx-2 border-t border-line" />}
          {NAV2.map(item => <SideLink key={item.to} {...item} collapsed={collapsed} />)}
        </motion.nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <AnimatedAvatar
              src={profile.avatarUrl}
              fallback={profile.avatar ?? profile.displayName[0]}
              hue={profile.avatarHue ?? 245}
              size={34}
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{profile.displayName}</div>
                <div className="truncate text-[11px] text-muted">@{profile.username}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <StreakBadge days={profile.streakCurrent} size="sm" />
              <NavLink
                to="/app/settings"
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${(profile.tier ?? 'free') === 'free' ? 'bg-white/5 text-muted hover:text-secondary' : 'streak-gradient text-white'}`}
                title={(profile.tier ?? 'free') === 'free' ? 'Free plan — tap to see plans' : 'Paid plan active'}
              >
                {(profile.tier ?? 'free') === 'free' ? 'Free' : profile.tier === 'team' ? 'CEO' : 'Pro'}
              </NavLink>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-base/80 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2.5 md:hidden">
              <Logo size={26} /><span className="font-bold tracking-tight">{pageTitle}</span>
            </div>
            <h1 className="hidden text-[15px] font-semibold md:block">{pageTitle}</h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <motion.span
                  className="text-sm"
                  animate={{ y: [0, -2, 0], rotate: [0, -4, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                >
                  🦉
                </motion.span>
                <span className="time-glow font-mono text-xs font-semibold">{format(now, 'EEE d MMM · HH:mm')}</span>
              </span>
              <button onClick={() => setPaletteOpen(true)} className="rounded-lg p-2 text-secondary hover:bg-white/5 md:hidden">
                <Search size={17} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-2xl md:hidden">
        <div className="flex items-stretch justify-around">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="flex min-w-[44px] flex-col items-center gap-0.5 px-2 py-2">
              {({ isActive }) => (
                <>
                  <div className={`relative rounded-xl px-3.5 py-1 transition-colors ${isActive ? 'text-accent' : 'text-muted'}`}>
                    {isActive && (
                      <motion.div layoutId="mobile-pill" className="absolute inset-0 rounded-xl bg-accent/15"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <Icon size={20} className="relative" />
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted'}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </AnimatePresence>
      <AchievementToast />
      <Copilot />
    </div>
  )
}

function SideLink({ to, label, icon: Icon, collapsed }: { to: string; label: string; icon: typeof Sun; collapsed: boolean }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}>
      <NavLink to={to} className="relative block">
        {({ isActive }) => (
          <div className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors ${isActive ? 'text-primary' : 'text-secondary hover:bg-white/[0.03] hover:text-primary'}`}>
            {isActive && (
              <motion.div
                layoutId="side-pill"
                className="absolute inset-0 rounded-lg bg-accent/15"
                style={{ boxShadow: '0 0 24px rgba(99,102,241,0.15)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <Icon size={16} className={`relative shrink-0 ${isActive ? 'text-accent' : ''}`} />
            {!collapsed && <span className="relative font-medium">{label}</span>}
          </div>
        )}
      </NavLink>
    </motion.div>
  )
}
