// ── Cloud sync — every real user's data lands in Supabase ──
// Tables (visible in Supabase → Table Editor):
//   profiles          → who the user is (name, project, stage, tier)
//   ship_events       → every ship they log
//   daily_logs        → evening close-outs (energy, mood, lessons)
//   changelog_entries → published changelogs
//   content_pieces    → AI-written posts they save
//   payments          → every Paystack checkout
// All writes are fire-and-forget: the app never blocks on the network,
// local state is the source of truth, the cloud is the mirror n8n reads.
import { supabase } from './supabase'
import type { ShipEvent, DailyLog, Profile, ChangelogEntry } from './types'

// ── Sync health — failures must be VISIBLE, never silent ──
// Every push records its outcome here; the Integrations page reads it so a
// dead Supabase project shows up as a red "not backing up" instead of a lie.
let lastSyncError: string | null = null
let lastSyncOk: string | null = null
export const syncHealth = () => ({ error: lastSyncError, lastOk: lastSyncOk })
function noteResult(scope: string, error: { message: string } | null) {
  if (error) {
    lastSyncError = `${scope}: ${error.message}`
    console.error(`[sync] ${scope} FAILED — data is NOT backing up:`, error.message)
  } else {
    lastSyncOk = new Date().toISOString()
    lastSyncError = null
  }
}

// Can we actually reach the Supabase project? A deleted/paused project fails
// DNS entirely — fetch throws — which is different from an RLS/schema error.
// ANY HTTP response (even 401) means the project is alive and reachable;
// only a thrown fetch (DNS/timeout) means it's truly gone.
export async function checkCloudHealth(): Promise<'ok' | 'unreachable' | 'unconfigured'> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !supabase) return 'unconfigured'
  try {
    await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      headers: anon ? { apikey: anon } : undefined,
      signal: AbortSignal.timeout(8000),
    })
    return 'ok'
  } catch {
    lastSyncError = 'Supabase project unreachable — check your connection or that the project still exists'
    return 'unreachable'
  }
}

export interface CloudUser {
  id: string
  email?: string
  name?: string
  username?: string
  avatarUrl?: string
}

// Pull the human out of the auth payload — GitHub/Google/email all differ.
export function userFromSession(u: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): CloudUser {
  const m = u.user_metadata ?? {}
  const str = (k: string) => (typeof m[k] === 'string' && (m[k] as string).trim()) ? (m[k] as string).trim() : undefined
  return {
    id: u.id,
    email: u.email,
    name: str('full_name') ?? str('name') ?? str('user_name') ?? u.email?.split('@')[0],
    username: (str('user_name') ?? str('preferred_username') ?? u.email?.split('@')[0] ?? 'builder')
      .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'builder',
    avatarUrl: str('avatar_url'),
  }
}

export async function fetchCloudProfile(userId: string) {
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data as Record<string, unknown> | null
}

export async function fetchCloudData(userId: string): Promise<{ events: ShipEvent[]; dailyLogs: DailyLog[] } | null> {
  if (!supabase) return null
  const [ev, dl] = await Promise.all([
    supabase.from('ship_events').select('*').eq('user_id', userId).order('event_time', { ascending: false }).limit(500),
    supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(120),
  ])
  const events: ShipEvent[] = (ev.data ?? []).map(r => ({
    id: r.id,
    source: r.source,
    category: r.category,
    title: r.title,
    description: r.description ?? undefined,
    importance: r.importance ?? 5,
    isPinned: r.is_pinned ?? false,
    eventDate: r.event_date,
    eventTime: r.event_time,
    repo: r.repo ?? undefined,
  }))
  const dailyLogs: DailyLog[] = (dl.data ?? []).map(r => ({
    id: r.id,
    logDate: r.log_date,
    whatIBuilt: r.what_i_built ?? '',
    whatBlockedMe: r.what_blocked_me ?? '',
    whatILearned: r.what_i_learned ?? '',
    energyLevel: r.energy_level ?? 3,
    mood: r.mood ?? 'good',
  }))
  return { events, dailyLogs }
}

export function pushProfile(userId: string, p: Partial<Profile> & { email?: string; startStage?: string }) {
  if (!supabase) return
  // Core identity — columns that exist in every schema version. These MUST
  // land: current_project_name is what tells a future login "this person
  // already onboarded, welcome them back".
  const core = {
    id: userId,
    ...(p.username ? { username: p.username } : {}),
    ...(p.displayName ? { display_name: p.displayName } : {}),
    ...(p.avatarUrl !== undefined ? { avatar_url: p.avatarUrl } : {}),
    ...(p.bio !== undefined ? { bio: p.bio } : {}),
    ...(p.projectName ? { current_project_name: p.projectName } : {}),
    ...(p.projectTagline !== undefined ? { current_project_tagline: p.projectTagline } : {}),
    ...(p.tier ? { tier: p.tier } : {}),
    // The rest of who they are — links, voice, look. All exist in schema.sql.
    ...(p.website !== undefined ? { website: p.website } : {}),
    ...(p.twitter !== undefined ? { twitter_handle: p.twitter } : {}),
    ...(p.github !== undefined ? { github_username: p.github } : {}),
    ...(p.tone ? { default_tone: p.tone } : {}),
    ...(p.theme ? { theme: p.theme } : {}),
    updated_at: new Date().toISOString(),
  }
  // Newer columns (upgrade-payments-accounts.sql). If the DB hasn't run that
  // migration yet, the full upsert fails with 42703 — retry with core only so
  // one missing column can never wipe out the whole profile save again.
  const full = {
    ...core,
    ...(p.startStage ? { start_stage: p.startStage } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.avatar !== undefined ? { avatar: p.avatar } : {}),
    ...(p.avatarHue !== undefined ? { avatar_hue: p.avatarHue } : {}),
  }
  supabase.from('profiles').upsert(full, { onConflict: 'id' }).then(({ error }) => {
    if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message))) {
      console.error('[sync] profile: DB is missing newer columns — run supabase/upgrade-payments-accounts.sql. Saving core fields only.')
      supabase!.from('profiles').upsert(core, { onConflict: 'id' }).then(({ error: e2 }) => noteResult('profile', e2))
    } else {
      noteResult('profile', error)
    }
  })
}

export function pushEvent(userId: string, e: ShipEvent) {
  if (!supabase) return
  supabase.from('ship_events').insert({
    user_id: userId,
    source: e.source,
    category: e.category,
    title: e.title,
    description: e.description ?? null,
    importance: e.importance,
    is_pinned: e.isPinned,
    event_date: e.eventDate,
    event_time: e.eventTime,
    repo: e.repo ?? null,
  }).then(({ error }) => noteResult('event', error))
}

export function pushDailyLog(userId: string, l: Omit<DailyLog, 'id'>) {
  if (!supabase) return
  supabase.from('daily_logs').upsert({
    user_id: userId,
    log_date: l.logDate,
    what_i_built: l.whatIBuilt,
    what_blocked_me: l.whatBlockedMe,
    what_i_learned: l.whatILearned,
    energy_level: l.energyLevel,
    mood: l.mood,
  }, { onConflict: 'user_id,log_date' }).then(({ error }) => noteResult('daily log', error))
}

export function pushChangelog(userId: string, c: Omit<ChangelogEntry, 'id' | 'publishedAt'>) {
  if (!supabase) return
  supabase.from('changelog_entries').insert({
    user_id: userId,
    version_tag: c.versionTag ?? null,
    title: c.title,
    body: c.body,
  }).then(({ error }) => noteResult('changelog', error))
}

// Payments are recorded even for visitors who aren't signed in —
// the row carries the email from the Paystack receipt. amountMinor is the
// smallest unit of whichever currency was charged (kobo for ₦, cents for $).
export function recordPayment(p: { email: string; amountMinor: number; currency: 'NGN' | 'USD'; tier: string; cycle: string; reference?: string }) {
  if (!supabase) return
  supabase.auth.getUser().then(({ data }) => {
    supabase!.from('payments').insert({
      user_id: data.user?.id ?? null,
      email: p.email,
      amount_kobo: p.amountMinor,
      currency: p.currency,
      tier: p.tier,
      cycle: p.cycle,
      paystack_ref: p.reference ?? null,
      status: 'success-client',
    }).then(({ error }) => noteResult('payment', error))
  })
}
