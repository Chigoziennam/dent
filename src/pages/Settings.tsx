import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LogOut, ExternalLink, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShipLog } from '../lib/store'
import type { Tone } from '../lib/types'
import { Page, GlassCard, SectionTitle } from '../components/ui'

export default function Settings() {
  const { profile, updateProfile, logout } = useShipLog()
  const [form, setForm] = useState(profile)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const save = () => {
    updateProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const signOut = () => { logout(); navigate('/') }

  return (
    <Page className="max-w-2xl">
      <GlassCard>
        <SectionTitle>Your builder identity</SectionTitle>
        <div className="flex flex-wrap items-start gap-5">
          {/* Current avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl text-4xl"
              style={{ background: `linear-gradient(135deg, hsl(${form.avatarHue ?? 245} 70% 55% / 0.35), hsl(${(form.avatarHue ?? 245) + 60} 70% 55% / 0.25))`, border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {form.avatarUrl
                ? <img src={form.avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
                : (form.avatar ?? '🧑‍💻')}
            </div>
            <span className="text-[10px] text-muted">you, currently</span>
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
        <div className="mt-2 flex gap-2">
          {(['founder', 'technical', 'storytelling'] as Tone[]).map(t => (
            <button key={t} onClick={() => setForm({ ...form, tone: t })}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${form.tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 text-xs font-medium text-secondary">Theme</div>
        <div className="mt-2 flex gap-2">
          <span className="rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 text-[12.5px] font-medium text-accent">Dark</span>
          <span className="cursor-not-allowed rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-muted opacity-50">Light — soon</span>
        </div>
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
  db('notionists', 'kernel'), db('notionists', 'segfault'), db('notionists', 'lambda'), db('notionists', 'vector'),
  db('adventurer', 'turing'), db('adventurer', 'ada'), db('adventurer', 'hopper'), db('adventurer', 'linus'),
  db('bottts', 'mainframe'), db('bottts', 'compiler'), db('bottts', 'daemon'), db('bottts', 'cron'),
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
