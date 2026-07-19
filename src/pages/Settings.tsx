import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LogOut, ExternalLink, Check, Download, Zap } from 'lucide-react'
import { supabaseReady } from '../lib/supabase'
import { pendingSyncCount, syncHealth } from '../lib/sync'

import { Link } from 'react-router-dom'
import { useDent } from '../lib/store'
import { entitlementsFor, tierOf, planState, daysLeft } from '../lib/plan'
import { TONE_META, VIBE_META, type Tone, type CopilotVibe } from '../lib/types'
import { Page, GlassCard, SectionTitle, AnimatedAvatar } from '../components/ui'

// The real prices, in both currencies, so the number here matches the number
// at the Paystack popup. Mirrors PRICES in src/pages/Pricing.tsx.
const PLAN_OPTIONS = [
  { cycle: 'monthly' as const, label: 'Pro · monthly', ngn: 5000, usd: 9, note: null },
  { cycle: 'yearly' as const, label: 'Pro · yearly', ngn: 4200 * 12, usd: 7 * 12, note: '2 months free' },
]

export default function Settings() {
  const { profile, updateProfile, logout } = useDent()
  const aiLeft = useDent(s => s.aiLeftThisWeek())
  const chatLeft = useDent(s => s.chatLeftToday())
  const ent = entitlementsFor(profile)
  // 'free' | 'active' | 'grace' | 'expired' — drives the whole plan card.
  const state = planState(profile)
  const left = daysLeft(profile)
  const expiryLabel = profile.planExpiresAt
    ? new Date(profile.planExpiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const [form, setForm] = useState(profile)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()
  const syncErr = syncHealth().error
  const pending = pendingSyncCount()

  const save = () => {
    updateProfile(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const signOut = () => { logout(); navigate('/') }

  // Data ownership: export the LOGS from the window you choose, always wrapped
  // with WHO you are — name, project, achievements, level — so the file stands
  // on its own. `days: null` means your whole history.
  const exportData = (days: number | null) => {
    const s = useDent.getState()
    const cutoff = days == null ? '' : new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
    const inRange = <T extends { eventDate?: string; logDate?: string; createdAt?: string; publishedAt?: string }>(arr: T[], key: keyof T) =>
      days == null ? arr : arr.filter(x => String(x[key] ?? '') >= cutoff)
    const events = inRange(s.events, 'eventDate')
    const dailyLogs = inRange(s.dailyLogs, 'logDate')
    const label = days == null ? 'all' : days === 0 ? 'today' : `${days}d`
    const payload = {
      exportedAt: new Date().toISOString(),
      range: days == null ? 'all-time' : days === 0 ? 'today' : `last-${days}-days`,
      // WHO — always included so the logs have an owner and context.
      you: {
        displayName: s.profile.displayName,
        username: s.profile.username,
        project: s.profile.projectName,
        tagline: s.profile.projectTagline,
        level: Math.floor(s.profile.builderScore / 500) + 1,
        builderScore: s.profile.builderScore,
        streak: s.profile.streakCurrent,
        totalShips: s.profile.totalShips,
      },
      achievements: s.unlocked,
      // WHAT — scoped to the chosen window.
      events,
      dailyLogs,
      content: inRange(s.content, 'createdAt'),
      changelog: inRange(s.changelog, 'publishedAt'),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dent-${s.profile.username}-${label}-${new Date().toISOString().slice(0, 10)}.json`
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
                <button key={url} onClick={() => { setForm({ ...form, avatarUrl: url }); updateProfile({ avatarUrl: url }) }}
                  className={`overflow-hidden rounded-xl border transition-all ${form.avatarUrl === url ? 'scale-110 border-accent shadow-[0_0_16px_rgba(99,102,241,0.4)]' : 'border-line opacity-75 hover:scale-105 hover:opacity-100'}`}>
                  <img src={url} alt="avatar option" loading="lazy" className="aspect-square w-full bg-white/[0.03] object-cover" />
                </button>
              ))}
            </div>

            <div className="mt-3.5 mb-1.5 text-xs font-medium text-secondary">Or keep it minimal</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map(a => (
                <button key={a} onClick={() => { setForm({ ...form, avatar: a, avatarUrl: undefined }); updateProfile({ avatar: a, avatarUrl: undefined }) }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-all ${!form.avatarUrl && form.avatar === a ? 'border-accent bg-accent/20 scale-110' : 'border-line opacity-70 hover:opacity-100'}`}>
                  {a}
                </button>
              ))}
            </div>

            <div className="mt-3.5 mb-1.5 text-xs font-medium text-secondary">Ring color</div>
            <div className="flex gap-1.5">
              {HUES.map(h => (
                <button key={h} onClick={() => { setForm({ ...form, avatarHue: h }); updateProfile({ avatarHue: h }) }}
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
            <button key={t} onClick={() => { setForm({ ...form, tone: t }); updateProfile({ tone: t }) }} title={TONE_META[t].hint}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${form.tone === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              {TONE_META[t].label}
            </button>
          ))}
        </div>
        {/* The writing voice above is how the WRITER talks to your audience.
            This is how the CO-PILOT talks to you — different jobs, and plenty
            of people want dry posts but a companion that jokes back. */}
        <div className="mt-4 text-xs font-medium text-secondary">Co-pilot personality</div>
        <p className="mt-0.5 text-[11px] text-muted">How your companion talks to you. It always stays on your work.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(VIBE_META) as CopilotVibe[]).map(v => (
            <button key={v} onClick={() => { setForm({ ...form, copilotVibe: v }); updateProfile({ copilotVibe: v }) }} title={VIBE_META[v].hint}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${(form.copilotVibe ?? 'mate') === v ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              {VIBE_META[v].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">{VIBE_META[form.copilotVibe ?? 'mate'].hint}</p>

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
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
          state === 'expired' ? 'bg-red-400/15 text-red-400'
          : state === 'grace' ? 'bg-warning/15 text-warning'
          : state === 'active' ? 'streak-gradient text-white'
          : 'bg-white/5 text-muted'}`}>
          {state === 'expired' ? 'Plan ended' : state === 'grace' ? 'Renewal due' : state === 'active' ? 'Pro' : 'Free plan'}
        </span>
      </div>

      {/* An ended plan is the one thing that must never be quiet — the user
          keeps every ship they logged, but the limits changed under them and
          they deserve to know why before they hit a wall. */}
      {state === 'expired' && (
        <div className="mb-3 rounded-lg border border-red-400/30 bg-red-400/[0.07] px-3 py-2.5">
          <p className="text-xs font-semibold text-red-400">Your Pro plan ended{expiryLabel ? ` on ${expiryLabel}` : ''}.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-secondary">
            You are back on the Free limits. Nothing you logged is lost — every ship, log and post is still here.
            <Link to="/pricing" className="ml-1 font-semibold text-accent hover:underline">Renew to lift the limits →</Link>
          </p>
        </div>
      )}
      {state === 'grace' && (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2.5">
          <p className="text-xs font-semibold text-warning">Renewal didn&apos;t go through.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-secondary">
            Pro stays on for {left !== null ? Math.max(0, left + 3) : 3} more day{left !== null && Math.max(0, left + 3) === 1 ? '' : 's'} while you sort it out — cards fail for boring reasons.
            <Link to="/pricing" className="ml-1 font-semibold text-accent hover:underline">Retry payment →</Link>
          </p>
        </div>
      )}
      {state === 'active' && expiryLabel && (
        <p className="mb-3 text-[11px] text-muted">
          Pro is active — renews on <span className="text-secondary">{expiryLabel}</span>
          {left !== null && left <= 7 ? ` (${left} day${left === 1 ? '' : 's'} away)` : ''}.
        </p>
      )}

      {/* What they have left, stated as counts rather than a vague bar. */}
      <div className="space-y-2.5">
        {([
          { label: 'AI posts this week', used: ent.aiPerWeek - aiLeft, cap: ent.aiPerWeek },
          { label: 'Co-pilot messages today', used: ent.chatPerDay - chatLeft, cap: ent.chatPerDay },
        ] as const).map(row => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-secondary">{row.label}</span>
              <span className="font-mono text-xs text-primary">
                {row.used === null ? `up to ${row.cap}` : `${Math.max(0, row.cap - row.used)} / ${row.cap} left`}
              </span>
            </div>
            {row.used !== null && (
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(100, (Math.max(0, row.cap - row.used) / row.cap) * 100)}%`,
                  background: row.cap - row.used === 0 ? '#f59e0b' : '#6366f1',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nobody should have to guess what spends a credit. */}
      <div className="mt-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
        <p className="text-[11px] font-semibold text-secondary">What uses a credit?</p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted">
          <li>• <span className="text-secondary">One AI post</span> — writing from your ships, Fusion, or Raw notes → Human.</li>
          <li>• <span className="text-secondary">One co-pilot message</span> — counted separately, so chatting never eats your posts.</li>
          <li>• <span className="text-secondary">Free:</span> logging ships, GitHub sync, streaks, exports, and the Tighten / Thread / Stats tools.</li>
        </ul>
        <p className="mt-2 text-[11px] text-muted">
          Posts reset every Monday, co-pilot messages reset at midnight. Unused credits don&apos;t roll over.
        </p>
      </div>

      {/* Real prices in both currencies — no surprises at the Paystack popup. */}
      {tierOf(profile) === 'free' || state !== 'active' ? (
        <div className="mt-3">
          <p className="text-[11px] text-muted">
            Pro lifts this to <span className="text-secondary">100 posts a month and 30 co-pilot messages a day</span>,
            plus unlimited logging, Fusion, and the Resume &amp; Product Hunt formats.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAN_OPTIONS.map(o => (
              <Link key={o.cycle} to="/pricing"
                className="flex flex-col rounded-xl border border-line px-3.5 py-2 transition-colors hover:border-accent/50">
                <span className="text-xs font-semibold text-primary">{o.label}</span>
                <span className="font-mono text-[11px] text-accent">
                  ₦{o.ngn.toLocaleString()} <span className="text-muted">· ${o.usd}</span>
                </span>
                {o.note && <span className="text-[10px] text-success">{o.note}</span>}
              </Link>
            ))}
            <Link to="/pricing" className="flex items-center rounded-xl bg-accent/15 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/25">
              {state === 'expired' || state === 'grace' ? 'Renew now →' : 'See plans →'}
            </Link>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Charged in naira through Paystack. Outside Nigeria, any Visa, Mastercard or Amex works —
            your bank converts the ${PLAN_OPTIONS[0].usd} automatically (some banks add a 1-3% foreign-transaction fee).
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2.5">
          <Zap size={14} className="text-accent" />
          <span className="text-xs text-secondary">
            <span className="font-semibold text-primary">Pro is active.</span> Thanks for shipping with us.
          </span>
        </div>
      )}
      </GlassCard>

      <GlassCard className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Data</SectionTitle>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${syncErr ? 'bg-red-400/15 text-red-400' : supabaseReady ? 'bg-success/15 text-success' : 'bg-white/5 text-muted'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${syncErr ? 'bg-red-400' : supabaseReady ? 'bg-success' : 'bg-muted'}`} />
            {syncErr ? 'Cloud sync error' : supabaseReady ? 'Cloud sync on' : 'Cloud not configured'}
          </span>
        </div>
        {/* Pick the window — the file always carries your name, project & badges */}
        <div className="mt-1 mb-2.5 text-[11px] font-medium text-secondary">Export the logs from</div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { label: 'Today', days: 0 },
            { label: 'Last 7 days', days: 7 },
            { label: 'Last 30 days', days: 30 },
            { label: 'Last 90 days', days: 90 },
            { label: 'All time', days: null },
          ] as const).map(r => (
            <motion.button
              key={r.label}
              whileTap={{ scale: 0.96 }}
              onClick={() => exportData(r.days)}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-secondary transition-colors hover:border-accent/50 hover:text-primary"
            >
              <Download size={13} /> {r.label}
            </motion.button>
          ))}
          {pending > 0 && (
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-secondary">
              {pending} change{pending === 1 ? '' : 's'} waiting to sync
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
          Downloads a JSON of your ships, reflections, drafts and changelog from that window — always wrapped with your name, project, level and achievements, so it stands on its own.
          {syncErr
            ? ` Last cloud save failed (${syncErr}) — changes are queued and retried automatically.`
            : supabaseReady
              ? ' Everything is also backed up to the cloud as you go.'
              : ' Add your Supabase keys to .env to enable cloud sync.'}
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
