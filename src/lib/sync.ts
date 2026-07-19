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
import type { ShipEvent, DailyLog, Profile, ChangelogEntry, ContentPiece } from './types'

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

// ── Retry queue — a failed save is retried, never lost ──
// Fire-and-forget used to mean fire-and-forget-forever: an expired session or
// a dead connection silently dropped the row. Now every failed write lands in
// localStorage and is retried on reconnect / next login / every minute.
type QueueItem = { table: string; row: Record<string, unknown>; conflict?: string }
const QKEY = 'shiplog-sync-queue'
function loadQueue(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(QKEY) ?? '[]') } catch { return [] }
}
function saveQueue(q: QueueItem[]) {
  try { localStorage.setItem(QKEY, JSON.stringify(q.slice(0, 500))) } catch { /* storage full — drop */ }
}
function enqueue(item: QueueItem) { saveQueue([...loadQueue(), item]) }

// One writer for every table. `conflict` turns the insert into an upsert.
// Duplicate rows (23505) are success — the data is already there.
async function send(item: QueueItem): Promise<boolean> {
  if (!supabase) return false
  const { error } = item.conflict
    ? await supabase.from(item.table).upsert(item.row, { onConflict: item.conflict, ignoreDuplicates: item.table === 'ship_events' })
    : await supabase.from(item.table).insert(item.row)
  if (error && error.code === '23505') { noteResult(item.table, null); return true }
  // 42P10 = the unique index for this ON CONFLICT doesn't exist yet
  // (upgrade SQL not run) — fall back to a plain insert so nothing is lost.
  if (error && error.code === '42P10') {
    const { error: e2 } = await supabase.from(item.table).insert(item.row)
    noteResult(item.table, e2 && e2.code !== '23505' ? e2 : null)
    return !e2 || e2.code === '23505'
  }
  noteResult(item.table, error)
  return !error
}

function sendOrQueue(item: QueueItem) {
  send(item).then(ok => { if (!ok) enqueue(item) }).catch(() => enqueue(item))
}

// Retry everything that ever failed. Safe to call any time.
let flushing = false
export async function flushSyncQueue() {
  if (flushing || !supabase) return
  const q = loadQueue()
  if (q.length === 0) return
  flushing = true
  try {
    const failed: QueueItem[] = []
    for (const item of q) {
      const ok = await send(item).catch(() => false)
      if (!ok) failed.push(item)
    }
    saveQueue(failed)
  } finally { flushing = false }
}
export const pendingSyncCount = () => loadQueue().length

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

// Everything about "who you are and how far you've come" that must follow the
// account to any browser: identity, look, voice, AND progress (score, streak,
// unlocked achievements, weekly AI usage). All of it rides one profiles row.
export type ProfileSync = Partial<Profile> & {
  email?: string
  startStage?: string
  unlocked?: Record<string, string>
  aiWeek?: string
  aiWeekCount?: number
  aiUsed?: number
}

export function pushProfile(userId: string, p: ProfileSync) {
  if (!supabase) return
  // Core identity + progress — columns that exist in base schema.sql. These
  // MUST land: current_project_name is what tells a future login "this person
  // already onboarded, welcome them back"; builder_score/streak keep their
  // level and fire from resetting on a new browser.
  const core = {
    id: userId,
    ...(p.username ? { username: p.username } : {}),
    ...(p.displayName ? { display_name: p.displayName } : {}),
    ...(p.avatarUrl !== undefined ? { avatar_url: p.avatarUrl } : {}),
    ...(p.bio !== undefined ? { bio: p.bio } : {}),
    ...(p.projectName ? { current_project_name: p.projectName } : {}),
    ...(p.projectTagline !== undefined ? { current_project_tagline: p.projectTagline } : {}),
    ...(p.tier ? { tier: p.tier } : {}),
    // Expiry travels WITH the tier — a tier that syncs without its expiry
    // date silently becomes permanent again on the next device.
    ...(p.planExpiresAt !== undefined ? { plan_expires_at: p.planExpiresAt } : {}),
    ...(p.planStartedAt !== undefined ? { plan_started_at: p.planStartedAt } : {}),
    ...(p.planCycle !== undefined ? { plan_cycle: p.planCycle } : {}),
    // The rest of who they are — links, voice, look. All exist in schema.sql.
    ...(p.website !== undefined ? { website: p.website } : {}),
    ...(p.twitter !== undefined ? { twitter_handle: p.twitter } : {}),
    ...(p.github !== undefined ? { github_username: p.github } : {}),
    ...(p.tone ? { default_tone: p.tone } : {}),
    ...(p.theme ? { theme: p.theme } : {}),
    // Progress — base-schema columns, so these are safe even without upgrades.
    ...(p.builderScore !== undefined ? { builder_score: p.builderScore } : {}),
    ...(p.streakCurrent !== undefined ? { streak_current: p.streakCurrent } : {}),
    ...(p.streakLongest !== undefined ? { streak_longest: p.streakLongest } : {}),
    ...(p.totalShips !== undefined ? { total_ships: p.totalShips } : {}),
    updated_at: new Date().toISOString(),
  }
  // Newer columns (upgrade SQL). If the DB hasn't run those migrations yet,
  // the full upsert fails with 42703 — retry with core only so one missing
  // column can never wipe out the whole profile save again.
  const full = {
    ...core,
    ...(p.startStage ? { start_stage: p.startStage } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.avatar !== undefined ? { avatar: p.avatar } : {}),
    ...(p.avatarHue !== undefined ? { avatar_hue: p.avatarHue } : {}),
    // Achievements + AI credits (upgrade-4). Cross-browser memory of progress.
    ...(p.unlocked !== undefined ? { unlocked: p.unlocked } : {}),
    ...(p.aiWeek !== undefined ? { ai_week: p.aiWeek } : {}),
    ...(p.aiWeekCount !== undefined ? { ai_week_count: p.aiWeekCount } : {}),
    ...(p.aiUsed !== undefined ? { ai_used: p.aiUsed } : {}),
  }
  supabase.from('profiles').upsert(full, { onConflict: 'id' }).then(({ error }) => {
    if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message))) {
      console.error('[sync] profile: DB is missing newer columns — run the latest supabase/upgrade-*.sql. Saving core fields only.')
      supabase!.from('profiles').upsert(core, { onConflict: 'id' }).then(({ error: e2 }) => {
        noteResult('profile', e2)
        // Even core failed (offline / transient) — queue it so it retries.
        if (e2 && e2.code !== '23505') enqueue({ table: 'profiles', row: core, conflict: 'id' })
      })
    } else {
      noteResult('profile', error)
      if (error && error.code !== '23505') enqueue({ table: 'profiles', row: full, conflict: 'id' })
    }
  })
}

// ── Screenshot proof → Supabase Storage, stored as a URL ──
// The image bytes live in the `proofs` bucket; the log only keeps the public
// URL, so a screenshot costs a few bytes in the row instead of megabytes.
// Path is namespaced by user id so the RLS policy can enforce ownership.
export async function uploadProof(userId: string, file: File): Promise<string | null> {
  if (!supabase) return null
  if (!file.type.startsWith('image/')) { lastSyncError = 'Only image files can be attached'; return null }
  if (file.size > 6 * 1024 * 1024) { lastSyncError = 'Screenshot is over 6MB — shrink it and retry'; return null }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('proofs').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || undefined,
  })
  if (error) {
    // Most likely the bucket/policy from upgrade-5 SQL isn't in place yet.
    lastSyncError = /bucket|not found/i.test(error.message)
      ? 'Screenshot storage not set up — run supabase/upgrade-5-proofs-storage.sql'
      : error.message
    console.error('[sync] proof upload failed:', error.message)
    return null
  }
  return supabase.storage.from('proofs').getPublicUrl(path).data.publicUrl ?? null
}

export function pushEvent(userId: string, e: ShipEvent) {
  // Upsert on (user_id, event_time, title) — a double login can never
  // duplicate a ship again (needs the unique index from upgrade-3 SQL).
  sendOrQueue({
    table: 'ship_events',
    conflict: 'user_id,event_time,title',
    row: {
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
    },
  })
}

export function pushDailyLog(userId: string, l: Omit<DailyLog, 'id'>) {
  sendOrQueue({
    table: 'daily_logs',
    conflict: 'user_id,log_date',
    row: {
      user_id: userId,
      log_date: l.logDate,
      what_i_built: l.whatIBuilt,
      what_blocked_me: l.whatBlockedMe,
      what_i_learned: l.whatILearned,
      energy_level: l.energyLevel,
      mood: l.mood,
    },
  })
}

export function pushChangelog(userId: string, c: Omit<ChangelogEntry, 'id' | 'publishedAt'>) {
  sendOrQueue({
    table: 'changelog_entries',
    row: {
      user_id: userId,
      version_tag: c.versionTag || null,
      title: c.title,
      body: c.body,
    },
  })
}

export function pushContent(userId: string, c: Omit<ContentPiece, 'id' | 'createdAt'>) {
  sendOrQueue({
    table: 'content_pieces',
    row: {
      user_id: userId,
      platform: c.platform,
      tone: c.tone,
      title: c.title ?? null,
      body: c.body,
      status: c.status,
    },
  })
}

// Payments are recorded even for visitors who aren't signed in —
// the row carries the email from the Paystack receipt. amountMinor is the
// smallest unit of whichever currency was charged (kobo for ₦, cents for $).
export function recordPayment(p: { email: string; amountMinor: number; currency: 'NGN' | 'USD'; tier: string; cycle: string; reference?: string }) {
  if (!supabase) return
  supabase.auth.getUser().then(({ data }) => {
    sendOrQueue({
      table: 'payments',
      row: {
        user_id: data.user?.id ?? null,
        email: p.email,
        amount_kobo: p.amountMinor,
        currency: p.currency,
        tier: p.tier,
        cycle: p.cycle,
        paystack_ref: p.reference ?? null,
        status: 'success-client',
      },
    })
  })
}
