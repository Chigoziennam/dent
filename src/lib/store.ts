import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, subDays } from 'date-fns'
import { generateSeed } from './seed'
import { track } from './telemetry'
import { supabase } from './supabase'
import {
  fetchCloudData, fetchCloudProfile, pushChangelog, pushDailyLog,
  pushEvent, pushProfile, type CloudUser,
} from './sync'
import type {
  ShipEvent, DailyLog, Profile, ContentPiece, ChangelogEntry,
  EventCategory, EventSource, Mood, Tone,
} from './types'
import { ACHIEVEMENTS } from './achievements'
import { entitlementsFor, weekKey, monthKey } from './plan'

interface DentState {
  profile: Profile
  events: ShipEvent[]
  dailyLogs: DailyLog[]
  content: ContentPiece[]
  changelog: ChangelogEntry[]
  unlocked: Record<string, string> // code -> date unlocked
  justUnlocked: string | null
  loggedIn: boolean
  // Real account identity — null means demo/anonymous
  userId: string | null
  // True while the store still holds the showcase seed data
  seeded: boolean
  // Integration credentials — stored locally on this device only
  creds: { githubToken?: string; githubUser?: string; githubLastSync?: string; supabaseUrl?: string; supabaseAnon?: string; paystackPublicKey?: string }
  aiUsed: number // AI generations used, lifetime (display)
  aiWeek: string // Monday-anchored week key the count below belongs to
  aiWeekCount: number // AI generations used this week (free-tier gate)

  login: () => void
  realLogin: (user: CloudUser) => Promise<void>
  importEvents: (incoming: ShipEvent[]) => number
  completeOnboarding: (o: { displayName: string; projectName: string; projectTagline: string; startStage: 'spark' | 'building' | 'launched' }) => void
  logout: () => void
  addEvent: (e: { title: string; category: EventCategory; source?: EventSource; description?: string }) => boolean
  togglePin: (id: string) => void
  deleteEvent: (id: string) => void
  saveDailyLog: (log: Omit<DailyLog, 'id'>) => void
  saveContent: (c: Omit<ContentPiece, 'id' | 'createdAt'>) => void
  publishChangelog: (entry: Omit<ChangelogEntry, 'id' | 'publishedAt'>) => void
  updateProfile: (p: Partial<Profile>) => void
  clearUnlockToast: () => void
  setCreds: (c: Partial<DentState['creds']>) => void
  // Plan gates — return false when the current tier's limit is reached.
  tryUseAI: () => boolean
  aiLeftThisWeek: () => number
  manualEventsThisMonth: () => number
}

function computeStreak(events: ShipEvent[], logs: DailyLog[]): { current: number; longest: number } {
  const days = new Set<string>()
  events.forEach(e => days.add(e.eventDate))
  logs.forEach(l => days.add(l.logDate))
  let current = 0
  let cursor = new Date()
  // Today counts if active; otherwise start from yesterday
  if (!days.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1)
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    current++
    cursor = subDays(cursor, 1)
  }
  // Longest: scan all days
  const sorted = [...days].sort()
  let longest = 0, run = 0, prev: Date | null = null
  for (const d of sorted) {
    const dt = new Date(d + 'T00:00:00')
    run = prev && dt.getTime() - prev.getTime() === 86400000 ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = dt
  }
  return { current, longest: Math.max(longest, current) }
}

function checkAchievements(state: Pick<DentState, 'events' | 'dailyLogs' | 'content' | 'profile' | 'unlocked'>): { unlocked: Record<string, string>; newCode: string | null; bonusXP: number } {
  const metrics: Record<string, number> = {
    total_events: state.events.length,
    total_commits: state.events.filter(e => e.category === 'commit').length,
    streak_days: state.profile.streakCurrent,
    daily_logs: state.dailyLogs.length,
    content_pieces: state.content.length,
    revenue_events: state.events.filter(e => e.category === 'revenue' || e.category === 'customer').length,
    level: Math.floor(state.profile.builderScore / 500) + 1,
  }
  const unlocked = { ...state.unlocked }
  let newCode: string | null = null
  let bonusXP = 0
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.code] && (metrics[a.metric] ?? 0) >= a.threshold) {
      unlocked[a.code] = format(new Date(), 'yyyy-MM-dd')
      newCode = a.code
      bonusXP += a.xp
    }
  }
  return { unlocked, newCode, bonusXP }
}

// Union two event lists — local edits win on conflict, order by newest.
// This is what makes a returning user NEVER lose data: cloud and local merge,
// neither side clobbers the other. Keyed by content (time+title), NOT id:
// cloud rows come back with server-generated uuids that never match the local
// ids (ev_<ts>, gh_<sha>), so an id-keyed merge would duplicate every ship.
function mergeEvents(local: ShipEvent[], cloud: ShipEvent[]): ShipEvent[] {
  const key = (e: ShipEvent) => `${e.eventTime}|${e.title}`
  const byKey = new Map<string, ShipEvent>()
  for (const e of cloud) byKey.set(key(e), e)
  for (const e of local) byKey.set(key(e), e) // local overwrites same content
  return [...byKey.values()].sort((a, b) => (b.eventTime || '').localeCompare(a.eventTime || ''))
}

function mergeLogs(local: DailyLog[], cloud: DailyLog[]): DailyLog[] {
  const byDate = new Map<string, DailyLog>()
  for (const l of cloud) byDate.set(l.logDate, l)
  for (const l of local) byDate.set(l.logDate, l) // local edits win
  return [...byDate.values()].sort((a, b) => b.logDate.localeCompare(a.logDate))
}

function buildInitial() {
  const seed = generateSeed()
  const streak = computeStreak(seed.events, seed.dailyLogs)
  const profile: Profile = {
    username: 'chigozie',
    displayName: 'Chigozie',
    bio: 'Founder at Nalto. Building tools for African schools and founders who ship.',
    projectName: 'Super Dent X',
    projectTagline: 'Build in Public. Without Thinking About It.',
    website: 'https://lumenai.sbs',
    twitter: 'NaltoHQ',
    github: 'Chigoziennam',
    tone: 'founder',
    streakCurrent: streak.current,
    streakLongest: streak.longest,
    builderScore: 2847,
    totalShips: seed.events.length,
  }
  // Pre-unlock achievements the seed data already satisfies
  const pre = checkAchievements({ events: seed.events, dailyLogs: seed.dailyLogs, content: seed.content, profile, unlocked: {} })
  return { profile, ...seed, unlocked: pre.unlocked }
}

export const useDent = create<DentState>()(
  persist(
    (set, get) => ({
      ...buildInitial(),
      justUnlocked: null,
      loggedIn: false,
      userId: null,
      seeded: true,
      creds: {},
      aiUsed: 0,
      aiWeek: weekKey(),
      aiWeekCount: 0,

      // Demo door: keeps the seeded showcase data
      login: () => { track('demo_login'); set({ loggedIn: true }) },

      // Real account. We only WIPE local data when this device is switching
      // owners — i.e. it still holds the demo seed, or a *different* person is
      // signing in. A returning user (same id, even after signing out) keeps
      // everything and merges the cloud on top. This is the fix for the app
      // "forgetting" people every time they sign out and back in.
      realLogin: async (user) => {
        const s = get()
        const switchingOwner = s.seeded || (!!s.userId && s.userId !== user.id)
        if (switchingOwner) {
          track('real_login_fresh')
          set({
            loggedIn: true, userId: user.id, seeded: false,
            events: [], dailyLogs: [], content: [], changelog: [], unlocked: {}, justUnlocked: null,
            profile: {
              ...s.profile,
              username: user.username ?? 'builder',
              displayName: user.name ?? 'Builder',
              email: user.email,
              avatarUrl: user.avatarUrl,
              avatar: undefined,
              bio: '',
              projectName: '',
              projectTagline: '',
              website: '', twitter: '', github: '',
              streakCurrent: 0, streakLongest: 0, builderScore: 0, totalShips: 0,
              tier: 'free', onboarded: false, startStage: undefined,
            },
          })
        } else {
          // Returning user: claim the session, keep their local history intact,
          // and top up identity fields the OAuth payload carries.
          set({
            loggedIn: true, userId: user.id, seeded: false,
            profile: {
              ...s.profile,
              email: user.email ?? s.profile.email,
              avatarUrl: user.avatarUrl ?? s.profile.avatarUrl,
              username: s.profile.username || user.username || 'builder',
              displayName: s.profile.displayName || user.name || 'Builder',
            },
          })
        }
        // Mirror down whatever the cloud already knows and MERGE it with local —
        // union by id / date, so nothing on either side is lost. Then push the
        // other direction: anything this device has that the cloud is missing
        // goes UP, so the account is whole no matter where you sign in next.
        try {
          const [cp, data] = await Promise.all([fetchCloudProfile(user.id), fetchCloudData(user.id)])
          if (data && (data.events.length > 0 || data.dailyLogs.length > 0)) {
            set(st => {
              const events = mergeEvents(st.events, data.events)
              const dailyLogs = mergeLogs(st.dailyLogs, data.dailyLogs)
              const streak = computeStreak(events, dailyLogs)
              return {
                events,
                dailyLogs,
                profile: {
                  ...st.profile,
                  streakCurrent: streak.current,
                  streakLongest: streak.longest,
                  totalShips: events.length,
                  builderScore: Math.max(st.profile.builderScore, events.length * 10 + dailyLogs.length * 25),
                },
              }
            })
          }
          // Backfill UP: local ships/logs the cloud doesn't have yet — work
          // logged while offline, or while an earlier cloud save was failing.
          {
            const st = get()
            const evKey = (e: ShipEvent) => `${e.eventTime}|${e.title}`
            const cloudEv = new Set((data?.events ?? []).map(evKey))
            st.events.filter(e => !cloudEv.has(evKey(e))).slice(0, 300)
              .forEach(e => pushEvent(user.id, e))
            const cloudDl = new Set((data?.dailyLogs ?? []).map(l => l.logDate))
            st.dailyLogs.filter(l => !cloudDl.has(l.logDate)).slice(0, 120)
              .forEach(l => pushDailyLog(user.id, l))
            // Re-assert the profile too — if it ever failed to save (e.g. a
            // missing DB column), this is what finally makes the cloud whole.
            if (st.profile.onboarded && st.profile.projectName) {
              pushProfile(user.id, { ...st.profile, email: st.profile.email })
            }
          }
          if (cp) {
            set(st => ({
              profile: {
                ...st.profile,
                username: (cp.username as string) ?? st.profile.username,
                displayName: (cp.display_name as string) ?? st.profile.displayName,
                bio: (cp.bio as string) ?? st.profile.bio,
                projectName: (cp.current_project_name as string) ?? st.profile.projectName,
                projectTagline: (cp.current_project_tagline as string) ?? st.profile.projectTagline,
                startStage: (cp.start_stage as Profile['startStage']) ?? st.profile.startStage,
                tier: (cp.tier as Profile['tier']) ?? st.profile.tier,
                // The look and voice they chose — a new browser must show THEM
                avatar: (cp.avatar as string) ?? st.profile.avatar,
                avatarHue: (cp.avatar_hue as number) ?? st.profile.avatarHue,
                avatarUrl: (cp.avatar_url as string) ?? st.profile.avatarUrl,
                website: (cp.website as string) ?? st.profile.website,
                twitter: (cp.twitter_handle as string) ?? st.profile.twitter,
                github: (cp.github_username as string) ?? st.profile.github,
                tone: (cp.default_tone as Profile['tone']) ?? st.profile.tone,
                theme: (cp.theme as Profile['theme']) ?? st.profile.theme,
                // A cloud profile with a project name means this person already
                // did the initial steps — NEVER send them through onboarding or
                // the tour again, on any browser or device.
                onboarded: Boolean(cp.current_project_name) || st.profile.onboarded,
                tourDone: Boolean(cp.current_project_name) || st.profile.tourDone,
              },
            }))
          }
        } catch { /* offline is fine — local wins */ }
      },

      completeOnboarding: (o) => {
        const s = get()
        set({ profile: { ...s.profile, ...o, onboarded: true } })
        if (s.userId) pushProfile(s.userId, { ...o, username: s.profile.username, email: s.profile.email })
        track('onboarded', { stage: o.startStage })
      },

      // Sign out of the session but REMEMBER whose device this is. Keeping
      // userId means the next sign-in with the same account is recognised as a
      // return (data kept), while a different account still triggers a clean
      // wipe via the switchingOwner check in realLogin.
      logout: () => {
        supabase?.auth.signOut()
        set({ loggedIn: false })
      },

      addEvent: (e) => {
        const s0 = get()
        const source = e.source ?? 'manual'
        // Manual logging is capped on Free; GitHub/other imports are exempt.
        if (source === 'manual') {
          const cap = entitlementsFor(s0.profile).manualEventsPerMonth
          if (get().manualEventsThisMonth() >= cap) return false
        }
        const now = new Date()
        const ev: ShipEvent = {
          id: `ev_${now.getTime()}`,
          source,
          category: e.category,
          title: e.title,
          description: e.description,
          importance: 5,
          isPinned: false,
          eventDate: format(now, 'yyyy-MM-dd'),
          eventTime: now.toISOString(),
        }
        const s = get()
        const events = [ev, ...s.events]
        const streak = computeStreak(events, s.dailyLogs)
        const profile = {
          ...s.profile,
          totalShips: s.profile.totalShips + 1,
          builderScore: s.profile.builderScore + 10,
          streakCurrent: streak.current,
          streakLongest: streak.longest,
        }
        const ach = checkAchievements({ events, dailyLogs: s.dailyLogs, content: s.content, profile, unlocked: s.unlocked })
        profile.builderScore += ach.bonusXP
        track('ship_logged', { category: ev.category })
        set({ events, profile, unlocked: ach.unlocked, justUnlocked: ach.newCode })
        if (s.userId) pushEvent(s.userId, ev)
        return true
      },

      // Bulk import from a real integration (GitHub sync). Events arrive with
      // stable ids (e.g. gh_<sha>) so re-syncing never creates duplicates.
      // Returns how many were actually new.
      importEvents: (incoming) => {
        const s = get()
        const have = new Set(s.events.map(e => e.id))
        const fresh = incoming.filter(e => !have.has(e.id))
        if (fresh.length === 0) return 0
        const events = [...fresh, ...s.events].sort((a, b) => (b.eventTime || '').localeCompare(a.eventTime || ''))
        const streak = computeStreak(events, s.dailyLogs)
        const profile = {
          ...s.profile,
          totalShips: s.profile.totalShips + fresh.length,
          builderScore: s.profile.builderScore + fresh.length * 10,
          streakCurrent: streak.current,
          streakLongest: streak.longest,
        }
        const ach = checkAchievements({ events, dailyLogs: s.dailyLogs, content: s.content, profile, unlocked: s.unlocked })
        profile.builderScore += ach.bonusXP
        track('events_imported', { count: fresh.length })
        set({ events, profile, unlocked: ach.unlocked, justUnlocked: ach.newCode })
        if (s.userId) fresh.forEach(e => pushEvent(s.userId!, e))
        return fresh.length
      },

      togglePin: (id) => set(s => ({ events: s.events.map(e => e.id === id ? { ...e, isPinned: !e.isPinned } : e) })),
      deleteEvent: (id) => set(s => ({ events: s.events.filter(e => e.id !== id) })),

      saveDailyLog: (log) => {
        const s = get()
        const existing = s.dailyLogs.find(l => l.logDate === log.logDate)
        const dailyLogs = existing
          ? s.dailyLogs.map(l => l.logDate === log.logDate ? { ...l, ...log } : l)
          : [{ ...log, id: `dl_${Date.now()}` }, ...s.dailyLogs]
        const streak = computeStreak(s.events, dailyLogs)
        const profile = {
          ...s.profile,
          builderScore: s.profile.builderScore + (existing ? 0 : 25),
          streakCurrent: streak.current,
          streakLongest: streak.longest,
        }
        const ach = checkAchievements({ events: s.events, dailyLogs, content: s.content, profile, unlocked: s.unlocked })
        profile.builderScore += ach.bonusXP
        track('daily_log_saved', { mood: log.mood, energy: log.energyLevel })
        set({ dailyLogs, profile, unlocked: ach.unlocked, justUnlocked: ach.newCode })
        if (s.userId) pushDailyLog(s.userId, log)
      },

      saveContent: (c) => {
        const s = get()
        const content = [{ ...c, id: `cp_${Date.now()}`, createdAt: format(new Date(), 'yyyy-MM-dd') }, ...s.content]
        const ach = checkAchievements({ ...s, content })
        set({
          content,
          unlocked: ach.unlocked,
          justUnlocked: ach.newCode,
          profile: { ...s.profile, builderScore: s.profile.builderScore + 15 + ach.bonusXP },
        })
      },

      publishChangelog: (entry) => {
        set(s => ({
          changelog: [{ ...entry, id: `cl_${Date.now()}`, publishedAt: format(new Date(), 'yyyy-MM-dd') }, ...s.changelog],
        }))
        const uid = get().userId
        if (uid) pushChangelog(uid, entry)
      },

      updateProfile: (p) => {
        set(s => ({ profile: { ...s.profile, ...p } }))
        const s = get()
        if (s.userId) pushProfile(s.userId, s.profile)
      },
      clearUnlockToast: () => set({ justUnlocked: null }),
      setCreds: (c) => set(s => ({ creds: { ...s.creds, ...c } })),

      // Charge one AI generation against the weekly allowance. Paid tiers are
      // unlimited (Infinity). Returns false when a Free user is out for the week.
      tryUseAI: () => {
        const s = get()
        const wk = weekKey()
        const used = s.aiWeek === wk ? s.aiWeekCount : 0
        const limit = entitlementsFor(s.profile).aiPerWeek
        if (used >= limit) return false
        track('ai_generated')
        set({ aiWeek: wk, aiWeekCount: used + 1, aiUsed: s.aiUsed + 1 })
        return true
      },
      aiLeftThisWeek: () => {
        const s = get()
        const used = s.aiWeek === weekKey() ? s.aiWeekCount : 0
        return Math.max(0, entitlementsFor(s.profile).aiPerWeek - used)
      },
      manualEventsThisMonth: () => {
        const mk = monthKey()
        return get().events.filter(e => e.source === 'manual' && e.eventDate.slice(0, 7) === mk).length
      },
    }),
    { name: 'shiplog-v1' }
  )
)

export function todayStr() { return format(new Date(), 'yyyy-MM-dd') }
