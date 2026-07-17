import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDent } from './lib/store'
import { supabase } from './lib/supabase'
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

// Picks up the Supabase session after OAuth/magic-link redirects —
// without this, a successful GitHub login still looked "logged out".
function AuthSync() {
  const login = useDent(s => s.login)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { if (data.session) login() })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) login()
    })
    return () => sub.subscription.unsubscribe()
  }, [login])
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
