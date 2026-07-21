import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDent } from './lib/store'
import { supabase } from './lib/supabase'
import { flushSyncQueue, userFromSession } from './lib/sync'
import { fetchGithubShips } from './lib/github'
import { track } from './lib/telemetry'
import InstallPrompt from './components/InstallPrompt'
import Landing from './pages/Landing'
import Login from './pages/Login'
const Pricing = lazy(() => import('./pages/Pricing'))
import Shell from './components/Shell'
const Today = lazy(() => import('./pages/Today'))
const Timeline = lazy(() => import('./pages/Timeline'))
const Week = lazy(() => import('./pages/Week'))
const Write = lazy(() => import('./pages/Write'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Changelog = lazy(() => import('./pages/Changelog'))
const Settings = lazy(() => import('./pages/Settings'))
const PublicProfile = lazy(() => import('./pages/Profile').then(m => ({ default: m.PublicProfile })))
const PublicChangelog = lazy(() => import('./pages/Profile').then(m => ({ default: m.PublicChangelog })))

// Routes load on first visit instead of all shipping in one 1.2 MB bundle
// that had to parse before anything rendered. Landing, Login and Shell stay
// eager — they ARE the first paint, so deferring them would only add a
// flash. The fallback is deliberately plain: a spinner that appears for
// 80ms reads as jank, so this is just a held frame.
function RouteFallback() {
  return <div className="min-h-dvh bg-base" />
}

// Picks up the Supabase session after OAuth/magic-link redirects.
// Real sessions go through realLogin: the demo seed is wiped, the profile
// takes the person's actual name from Google/GitHub/email, and their own
// cloud data hydrates in. The demo stays demo; accounts are accounts.
function AuthSync() {
  const realLogin = useDent(s => s.realLogin)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) realLogin(userFromSession(data.session.user))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) realLogin(userFromSession(session.user))
    })
    return () => sub.subscription.unsubscribe()
  }, [realLogin])
  return null
}

// Product analytics heartbeat + the sync retry loop: anything that failed to
// save (offline, expired session) is pushed up on reconnect and every minute.
function SyncPulse() {
  useEffect(() => {
    track('session_start')
    flushSyncQueue()
    const onOnline = () => flushSyncQueue()
    window.addEventListener('online', onOnline)
    const t = setInterval(flushSyncQueue, 60_000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(t) }
  }, [])
  return null
}

// GitHub, always current. The connection persists (token is in the store), but
// nothing pulled new commits on its own — you had to open Integrations and hit
// Sync, which made the whole thing feel "disconnected". This polls the saved
// account in the background: on load, whenever you refocus the tab, and every
// 8 minutes. importEvents is idempotent (dedupes on gh_<sha>) so re-pulling is
// free — your log just keeps itself up to date with every new commit and deploy.
function GithubPulse() {
  const githubUser = useDent(s => s.creds.githubUser)
  const githubToken = useDent(s => s.creds.githubToken)
  const importEvents = useDent(s => s.importEvents)
  const setCreds = useDent(s => s.setCreds)
  useEffect(() => {
    if (!githubUser) return
    let cancelled = false
    let inFlight = false
    const pull = async () => {
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        const ships = await fetchGithubShips({ user: githubUser, token: githubToken }, 30)
        if (cancelled) return
        const added = importEvents(ships)
        setCreds({ githubLastSync: new Date().toISOString() })
        if (added > 0) track('events_imported', { count: added, auto: true })
      } catch { /* background sync stays silent — Integrations shows real errors */ }
      finally { inFlight = false }
    }
    pull()
    const onFocus = () => pull()
    window.addEventListener('focus', onFocus)
    const t = setInterval(pull, 8 * 60_000)
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); clearInterval(t) }
  }, [githubUser, githubToken, importEvents, setCreds])
  return null
}

function ThemeSync() {
  const theme = useDent(s => s.profile.theme ?? 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#f4f4f8' : '#0a0a0f')
  }, [theme])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <AuthSync />
      <SyncPulse />
      <GithubPulse />
      <InstallPrompt />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Navigate to="/app/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="week" element={<Week />} />
          <Route path="write" element={<Write />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="changelog" element={<Changelog />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/:username" element={<PublicProfile />} />
        <Route path="/:username/changelog" element={<PublicChangelog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
