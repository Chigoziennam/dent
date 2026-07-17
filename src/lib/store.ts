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
  creds: { githubToken?: string; githubUser?: string; supabaseUrl?: string; supabaseAnon?: string; paystackPublicKey?: string }
  aiUsed: number // AI generations used this month

  login: () => void
  realLogin: (user: CloudUser) => Promise<void>
  completeOnboarding: (o: { displayName: string; projectName: string; projectTagline: string; startStage: 'spark' | 'building' | 'launched' }) => void
  logout: () => void
  addEvent: (e: { title: string; category: EventCategory; source?: EventSource; description?: string }) => void
  togglePin: (id: string) => void
  deleteEvent: (id: string) => void
  saveDailyLog: (log: Omit<DailyLog, 'id'>) => void
  saveContent: (c: Omit<ContentPiece, 'id' | 'createdAt'>) => void
  publishChangelog: (entry: Omit<ChangelogEntry, 'id' | 'publishedAt'>) => void
  updateProfile: (p: Partial<Profile>) => void
  clearUnlockToast: () => void
  setCreds: (c: Partial<DentState['creds']>) => void
  bumpAiUsage: () => void
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

      // Demo door: keeps the seeded showcase data
      login: () => { track('demo_login'); set({ loggedIn: true }) },

      // Real account: first arrival wipes the demo seed so the user starts
      // THEIR story — name comes from Google/GitHub/email, never "Chigozie".
      realLogin: async (user) => {
        const s = get()
        const fresh = s.seeded || s.userId !== user.id
        if (fresh) {
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
          set({ loggedIn: true })
        }
        // Mirror down whatever the cloud already knows (other devices, past sessions)
        try {
          const [cp, data] = await Promise.all([fetchCloudProfile(user.id), fetchCloudData(user.id)])
          if (data && (data.events.length > 0 || data.dailyLogs.length > 0)) {
            const streak = computeStreak(data.events, data.dailyLogs)
            set(st => ({
              events: data.events,
              dailyLogs: data.dailyLogs,
              profile: {
                ...st.profile,
                streakCurrent: streak.current,
                streakLongest: streak.longest,
                totalShips: data.events.length,
                builderScore: data.events.length * 10 + data.dailyLogs.length * 25,
              },
            }))
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
                onboarded: Boolean(cp.current_project_name) || st.profile.onboarded,
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

      logout: () => {
        supabase?.auth.signOut()
        set({ loggedIn: false, userId: null })
      },

      addEvent: (e) => {
        const now = new Date()
        const ev: ShipEvent = {
          id: `ev_${now.getTime()}`,
          source: e.source ?? 'manual',
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
      bumpAiUsage: () => {
        track('ai_generated')
        set(s => ({ aiUsed: s.aiUsed + 1 }))
      },
    }),
    { name: 'shiplog-v1' }
  )
)

export function todayStr() { return format(new Date(), 'yyyy-MM-dd') }
