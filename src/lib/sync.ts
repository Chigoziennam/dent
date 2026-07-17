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
  supabase.from('profiles').upsert({
    id: userId,
    ...(p.username ? { username: p.username } : {}),
    ...(p.displayName ? { display_name: p.displayName } : {}),
    ...(p.avatarUrl !== undefined ? { avatar_url: p.avatarUrl } : {}),
    ...(p.bio !== undefined ? { bio: p.bio } : {}),
    ...(p.projectName ? { current_project_name: p.projectName } : {}),
    ...(p.projectTagline !== undefined ? { current_project_tagline: p.projectTagline } : {}),
    ...(p.startStage ? { start_stage: p.startStage } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.tier ? { tier: p.tier } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).then(({ error }) => { if (error) console.warn('[sync] profile:', error.message) })
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
  }).then(({ error }) => { if (error) console.warn('[sync] event:', error.message) })
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
  }, { onConflict: 'user_id,log_date' }).then(({ error }) => { if (error) console.warn('[sync] daily log:', error.message) })
}

export function pushChangelog(userId: string, c: Omit<ChangelogEntry, 'id' | 'publishedAt'>) {
  if (!supabase) return
  supabase.from('changelog_entries').insert({
    user_id: userId,
    version_tag: c.versionTag ?? null,
    title: c.title,
    body: c.body,
  }).then(({ error }) => { if (error) console.warn('[sync] changelog:', error.message) })
}

// Payments are recorded even for visitors who aren't signed in —
// the row carries the email from the Paystack receipt.
export function recordPayment(p: { email: string; amountKobo: number; tier: string; cycle: string; reference?: string }) {
  if (!supabase) return
  supabase.auth.getUser().then(({ data }) => {
    supabase!.from('payments').insert({
      user_id: data.user?.id ?? null,
      email: p.email,
      amount_kobo: p.amountKobo,
      currency: 'NGN',
      tier: p.tier,
      cycle: p.cycle,
      paystack_ref: p.reference ?? null,
      status: 'success-client',
    }).then(({ error }) => { if (error) console.warn('[sync] payment:', error.message) })
  })
}
