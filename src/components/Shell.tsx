import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Clock, PenLine, BarChart3, ScrollText, Trophy, Plug, Settings,
  Search, ChevronsLeft, ChevronsRight, Sparkles, LayoutGrid, X, ExternalLink, ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { useDent } from '../lib/store'
import { Logo, StreakBadge, SpaceBackdrop, AnimatedAvatar } from './ui'
import { CommandPalette } from './CommandPalette'
import { AchievementToast } from './AchievementToast'
import { Copilot } from './Copilot'
import { Onboarding } from './Onboarding'
import { Tour } from './Tour'

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
]
// Everything else lives in the More sheet — the full app, phone included
const MORE_NAV = [
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/achievements', label: 'Achievements', icon: Trophy },
  { to: '/app/changelog', label: 'Changelog', icon: ScrollText },
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [topMenu, setTopMenu] = useState(false)
  const [now, setNow] = useState(new Date())
  const profile = useDent(s => s.profile)
  const userId = useDent(s => s.userId)
  const needsOnboarding = Boolean(userId) && !profile.onboarded
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

  const pageTitle = [...NAV, ...NAV2].find(n => location.pathname.startsWith(n.to))?.label ?? 'Super Dent X'

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
          {!collapsed && <span className="text-[15px] font-bold tracking-tight">Super Dent X</span>}
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
              {/* The owl + clock is a tappable menu — quick reach to search, the
                  co-pilot, settings and your public page from any screen. */}
              <button
                onClick={() => setTopMenu(o => !o)}
                className="flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-line hover:bg-white/[0.03]"
                aria-label="Quick menu"
                aria-expanded={topMenu}
              >
                <motion.span
                  className="text-sm"
                  animate={{ y: [0, -2, 0], rotate: [0, -4, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                >
                  🦉
                </motion.span>
                <span className="time-glow font-mono text-xs font-semibold">{format(now, 'EEE d MMM · HH:mm')}</span>
                <ChevronDown size={13} className={`text-muted transition-transform ${topMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick-menu dropdown */}
          <AnimatePresence>
            {topMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setTopMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="glass-strong absolute right-4 top-14 z-50 w-56 overflow-hidden !rounded-2xl p-1.5 md:right-8"
                >
                  <TopMenuItem icon={Search} label="Search the log" hint="⌘K" onClick={() => { setTopMenu(false); setPaletteOpen(true) }} />
                  <TopMenuItem icon={Sparkles} label="Ask the co-pilot" hint="AI" onClick={() => { setTopMenu(false); window.dispatchEvent(new Event('copilot:open')) }} />
                  <TopMenuItem icon={Settings} label="Settings" onClick={() => { setTopMenu(false); navigate('/app/settings') }} />
                  <TopMenuItem icon={ExternalLink} label="View public page" onClick={() => { setTopMenu(false); navigate(`/${profile.username}`) }} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — 4 pinned tabs + More opens the whole app */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-2xl md:hidden">
        <div className="flex items-stretch justify-around">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="flex min-w-[44px] flex-col items-center gap-0.5 px-2 py-2" onClick={() => setMoreOpen(false)}>
              {({ isActive }) => (
                <>
                  <div className={`relative rounded-xl px-3.5 py-1 transition-colors ${isActive && !moreOpen ? 'text-accent' : 'text-muted'}`}>
                    {isActive && !moreOpen && (
                      <motion.div layoutId="mobile-pill" className="absolute inset-0 rounded-xl bg-accent/15"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <Icon size={20} className="relative" />
                  </div>
                  <span className={`text-[10px] font-medium ${isActive && !moreOpen ? 'text-primary' : 'text-muted'}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(o => !o)} className="flex min-w-[44px] flex-col items-center gap-0.5 px-2 py-2">
            <div className={`relative rounded-xl px-3.5 py-1 transition-colors ${moreOpen ? 'text-accent' : 'text-muted'}`}>
              {moreOpen && <div className="absolute inset-0 rounded-xl bg-accent/15" />}
              <LayoutGrid size={20} className="relative" />
            </div>
            <span className={`text-[10px] font-medium ${moreOpen ? 'text-primary' : 'text-muted'}`}>More</span>
          </button>
        </div>
      </nav>

      {/* More sheet — everything the sidebar has, on the phone */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="glass-strong pb-safe fixed inset-x-0 bottom-0 z-40 !rounded-b-none p-5 pb-24 md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AnimatedAvatar src={profile.avatarUrl} fallback={profile.avatar ?? profile.displayName[0]} hue={profile.avatarHue ?? 245} size={36} />
                  <div>
                    <div className="text-sm font-semibold leading-tight">{profile.displayName}</div>
                    <div className="text-[11px] text-muted">@{profile.username}</div>
                  </div>
                </div>
                <button onClick={() => setMoreOpen(false)} className="rounded-lg p-2 text-muted hover:text-secondary"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {MORE_NAV.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to} to={to} onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => `flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 transition-colors ${isActive ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-secondary'}`}
                  >
                    <Icon size={19} />
                    <span className="text-[10.5px] font-medium">{label}</span>
                  </NavLink>
                ))}
                <NavLink
                  to={`/${profile.username}`} onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-line p-3.5 text-secondary"
                >
                  <ExternalLink size={19} />
                  <span className="text-[10.5px] font-medium">Public page</span>
                </NavLink>
              </div>
              <div className="mt-4 flex justify-center"><StreakBadge days={profile.streakCurrent} size="sm" /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </AnimatePresence>
      <AchievementToast />
      <Copilot />

      {/* First-run: onboarding questions, then the guided tour */}
      {needsOnboarding && <Onboarding />}
      <AnimatePresence>
        {!needsOnboarding && !profile.tourDone && <Tour />}
      </AnimatePresence>
    </div>
  )
}

function TopMenuItem({ icon: Icon, label, hint, onClick }: { icon: typeof Sun; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-secondary transition-colors hover:bg-white/[0.06] hover:text-primary"
    >
      <Icon size={15} className="text-accent" />
      <span className="flex-1 font-medium">{label}</span>
      {hint && <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9.5px] text-muted">{hint}</kbd>}
    </button>
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
