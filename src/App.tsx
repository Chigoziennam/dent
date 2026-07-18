import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDent } from './lib/store'
import { supabase } from './lib/supabase'
import { flushSyncQueue, userFromSession } from './lib/sync'
import { track } from './lib/telemetry'
import InstallPrompt from './components/InstallPrompt'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Pricing from './pages/Pricing'
import Shell from './components/Shell'
import Today from './pages/Today'
import Timeline from './pages/Timeline'
import Week from './pages/Week'
import Write from './pages/Write'
import Analytics from './pages/Analytics'
import Achievements from './pages/Achievements'
import Integrations from './pages/Integrations'
import Changelog from './pages/Changelog'
import Settings from './pages/Settings'
import { PublicProfile, PublicChangelog } from './pages/Profile'

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
      <InstallPrompt />
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
    </BrowserRouter>
  )
}
