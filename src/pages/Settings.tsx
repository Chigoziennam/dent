import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LogOut, ExternalLink, Check, Download, Zap } from 'lucide-react'
import { supabaseReady } from '../lib/supabase'

import { Link } from 'react-router-dom'
import { useDent } from '../lib/store'
import { entitlementsFor, tierOf } from '../lib/plan'
import { TONE_META, type Tone } from '../lib/types'
import { Page, GlassCard, SectionTitle, AnimatedAvatar } from '../components/ui'

export default function Settings() {
  const { profile, updateProfile, logout } = useDent()
  const aiLeft = useDent(s => s.aiLeftThisWeek())
  const [form, setForm] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [creditToast, setCreditToast] = useState(false)
  const navigate = useNavigate()

  const save = () => {
    updateProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const signOut = () => { logout(); navigate('/') }

  // Data ownership: one click, everything you ever logged
  const exportData = () => {
    const s = useDent.getState()
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      events: s.events,
      dailyLogs: s.dailyLogs,
      content: s.content,
      changelog: s.changelog,
      achievements: s.unlocked,
    }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dent-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page className="max-w-2xl">
      <GlassCard>
        <SectionTitle>Your builder identity</SectionTitle>
        <div className="flex flex-wrap items-start gap-5">
          {/* Current avatar preview — live, exactly as the world sees it */}
          <div className="flex flex-col items-center gap-2.5 pt-1">
            <AnimatedAvatar
              src={form.avatarUrl}
              fallback={form.avatar ?? '🧑‍💻'}
              hue={form.avatarHue ?? 245}
              size={80}
            />
            <span className="text-[10px] text-muted">you, live</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-xs font-medium text-secondary">Tech avatars</div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {TECH_AVATARS.map(url => (
                <button key={url} onClick={() => setForm({ ...form, avatarUrl: url })}
                  className={`overflow-hidden rounded-xl border transition-all ${form.avatarUrl === url ? 'scale-110 border-accent shadow-[0_0_16px_rgba(99,102,241,0.4)]' : 'border-line opacity-75 hover:scale-105 hover:opacity-100'}`}>
                  <img src={url} alt="avatar option" loading="lazy" className="aspect-square w-full bg-white/[0.03] object-cover" />
                </button>
              ))}
            </div>

            <div className="mt-3.5 mb-1.5 text-xs font-medium text-secondary">Or keep it minimal</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map(a => (
                <button key={a} onClick={() => setForm({ ...form, avatar: a, avatarUrl: undefined })}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-all ${!form.avatarUrl && form.avatar === a ? 'border-accent bg-accent/20 scale-110' : 'border-line opacity-70 hover:opacity-100'}`}>
                  {a}
                </button>
              ))}
            </div>

            <div className="mt-3.5 mb-1.5 text-xs font-medium text-secondary">Ring color</div>
            <div className="flex gap-1.5">
              {HUES.map(h => (
                <button key={h} onClick={() => setForm({ ...form, avatarHue: h })}
                  aria-label={`hue ${h}`}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${form.avatarHue === h ? 'scale-125 border-white/80' : 'border-transparent'}`}
                  style={{ background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${h + 60} 70% 55%))` }} />
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Profile</SectionTitle>
          <Link to={`/${profile.username}`} className="flex items-center gap-1 text-xs text-accent hover:underline">
            View public profile <ExternalLink size={11} />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Display name" value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} />
          <Input label="Username" value={form.username} onChange={v => setForm({ ...form, username: v })} />
          <Input label="Project name" value={form.projectName} onChange={v => setForm({ ...form, projectName: v })} />
          <Input label="Project tagline" value={form.projectTagline} onChange={v => setForm({ ...form, projectTagline: v })} />
          <Input label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} />
          <Input label="Twitter / X handle" value={form.twitter} onChange={v => setForm({ ...form, twitter: v })} />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-medium text-secondary">Bio</div>
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2}
            className="w-full resize-none rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm" />
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <SectionTitle>Preferences</SectionTitle>
        <div className="text-xs font-medium text-secondary">Default writing voice</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(TONE_META) as Tone[]).map(t => (
            <button key={t} onClick={() => setForm({ ...form, tone: t })} title={TONE_META[t].hint}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${form.tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              {TONE_META[t].label}
            </button>
          ))}
        </div>
        <div className="mt-4 text-xs font-medium text-secondary">Theme</div>
        <div className="mt-2 flex gap-2">
          {(['dark', 'light'] as const).map(th => (
            <button key={th} onClick={() => { setForm({ ...form, theme: th }); updateProfile({ theme: th }) }}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${(form.theme ?? 'dark') === th ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              {th === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Plan & AI Credits</SectionTitle>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${(profile.tier ?? 'free') === 'free' ? 'bg-white/5 text-muted' : 'streak-gradient text-white'}`}>
            {(profile.tier ?? 'free') === 'free' ? 'Free plan' : profile.tier === 'team' ? 'CEO Mode' : 'Pro'}
          </span>
        </div>
        {tierOf(profile) === 'free' ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-secondary">Free AI generations left this week</span>
              <span className="font-mono text-xs text-primary">{aiLeft} / {entitlementsFor(profile).aiPerWeek}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (aiLeft / entitlementsFor(profile).aiPerWeek) * 100)}%`,
                  background: aiLeft === 0 ? '#f59e0b' : '#6366f1',
                }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              The Free plan includes 2 AI generations a week and logs 30 ships a month. GitHub commit sync is
              always on. <Link to="/pricing" className="font-semibold text-accent hover:underline">Go Pro</Link> for
              unlimited AI, unlimited logging and the Raw-notes→Human writer.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2.5">
            <Zap size={14} className="text-accent" />
            <span className="text-xs text-secondary">
              <span className="font-semibold text-primary">Unlimited AI generations</span> — {tierOf(profile) === 'team' ? 'CEO Mode' : 'Pro'} is active. Thanks for shipping with us.
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: '+100 credits', price: '$3' },
            { label: '+250 credits', price: '$6' },
            { label: '+600 credits', price: '$12' },
          ].map(c => (
            <button
              key={c.label}
              type="button"
              onClick={() => setCreditToast(true)}
              className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-xs font-medium text-secondary transition-colors hover:border-accent/50 hover:text-primary"
            >
              <Zap size={12} className="text-warning" /> {c.label} <span className="font-mono text-muted">{c.price}</span>
            </button>
          ))}
          <Link to="/pricing" className="flex items-center rounded-xl bg-accent/15 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/25">
            See plans →
          </Link>
        </div>
        {creditToast && <p className="mt-2 text-[11px] text-success">Credit top-ups go live with payments at launch — Paystack confirmer is already wired ✓</p>}
      </GlassCard>

      <GlassCard className="mt-4">
        <SectionTitle>Data</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={exportData}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-primary"
          >
            <Download size={14} /> Export everything as JSON
          </motion.button>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${supabaseReady ? 'bg-success/15 text-success' : 'bg-white/5 text-muted'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${supabaseReady ? 'bg-success' : 'bg-muted'}`} />
            Supabase {supabaseReady ? 'connected' : 'not configured'}
          </span>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
          Your log belongs to you — the export includes every event, reflection, draft and achievement.
          {supabaseReady ? ' Cloud sync activates with the backend launch.' : ' Add your Supabase keys to .env to enable cloud sync.'}
        </p>
      </GlassCard>

      <div className="mt-4 flex items-center justify-between">
        <motion.button whileTap={{ scale: 0.97 }} onClick={save}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.3)]">
          {saved && <Check size={14} />} {saved ? 'Saved' : 'Save Changes'}
        </motion.button>
        <button onClick={signOut} className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-danger">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </Page>
  )
}

const AVATARS = ['🧑‍💻', '👩‍💻', '🦉', '🦜', '🚀', '⚡', '🔨', '🧠', '🐺', '🦅', '🌙', '☀️']
const HUES = [245, 200, 160, 30, 330, 275]

// Real avatar art (DiceBear styles, self-hosted in /public/avatars) —
// portraits, robots and pixel builders that actually look like a profile pic
const db = (style: string, seed: string) => `/avatars/${style}-${seed}.svg`
const TECH_AVATARS = [
  // THE SHIPLOG HEROES — original tech legends, glowing eyes and all
  '/avatars/hero-commitman.svg', '/avatars/hero-debugger.svg', '/avatars/hero-deploystorm.svg', '/avatars/hero-kernelknight.svg',
  '/avatars/hero-asyncavenger.svg', '/avatars/hero-gitblade.svg', '/avatars/hero-nightowl.svg', '/avatars/hero-stacksmith.svg',
  // portraits — every builder, every background
  db('notionists', 'kernel'), db('notionists', 'segfault'), db('notionists', 'lambda'), db('notionists', 'vector'),
  db('adventurer', 'turing'), db('adventurer', 'ada'), db('adventurer', 'hopper'), db('adventurer', 'linus'),
  db('adventurer', 'zara'), db('adventurer', 'kwame'), db('adventurer', 'mei'), db('adventurer', 'diego'),
  db('adventurer', 'amina'), db('adventurer', 'raj'),
  // fun & funny
  db('big-smile', 'byte'), db('big-smile', 'pixel'), db('big-smile', 'cache'), db('big-smile', 'sudo'),
  db('croodles', 'doodle'), db('croodles', 'sketch'), db('fun-emoji', 'zap'), db('fun-emoji', 'grin'),
  // space & minimal art
  db('micah', 'nova'), db('micah', 'orbit'), db('micah', 'cosmo'), db('micah', 'luna'),
  // hero mode — original superhero-style builders
  db('personas', 'titan'), db('personas', 'storm'), db('personas', 'blaze'), db('personas', 'phantom'),
  db('lorelei', 'nebula'), db('lorelei', 'comet'), db('lorelei', 'quasar'), db('lorelei', 'pulsar'),
  db('avataaars', 'ironclad'), db('avataaars', 'sentinel'), db('avataaars', 'vortex'), db('avataaars', 'zenith'),
  // robots & pixels
  db('bottts', 'mainframe'), db('bottts', 'compiler'), db('bottts', 'daemon'), db('bottts', 'cron'),
  db('bottts', 'astro'), db('bottts', 'rocket'),
  db('pixel-art', 'shipit'), db('pixel-art', 'debug'), db('pixel-art', 'deploy'), db('pixel-art', 'merge'),
]

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-secondary">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm" />
    </div>
  )
}
