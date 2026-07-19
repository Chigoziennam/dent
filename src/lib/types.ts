export type EventSource =
  | 'github' | 'vercel' | 'stripe' | 'linear' | 'supabase' | 'notion'
  | 'slack' | 'discord' | 'n8n' | 'manual' | 'ai_detected'

export type EventCategory =
  | 'commit' | 'deployment' | 'feature' | 'bugfix' | 'revenue'
  | 'customer' | 'milestone' | 'learning' | 'blocker' | 'idea'
  | 'launch' | 'integration' | 'design' | 'content' | 'other'

export type ContentPlatform =
  | 'twitter' | 'linkedin' | 'newsletter' | 'changelog' | 'blog'
  | 'threads' | 'devto' | 'producthunt' | 'resume'
export type Tone = 'founder' | 'technical' | 'storytelling' | 'hype' | 'mentor' | 'unfiltered'

export const TONE_META: Record<Tone, { label: string; hint: string }> = {
  founder: { label: 'Founder', hint: 'confident, casual, first-person' },
  technical: { label: 'Technical', hint: 'precise, architecture-first' },
  storytelling: { label: 'Storyteller', hint: 'narrative arc, problem → win' },
  hype: { label: 'Hype', hint: 'big energy, launch-day voice' },
  mentor: { label: 'Mentor', hint: 'calm, lessons-first, generous' },
  unfiltered: { label: 'Unfiltered', hint: 'raw, honest, 2am-commit energy' },
}
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type Mood = 'fire' | 'good' | 'meh' | 'tough' | 'burned_out'

export interface ShipEvent {
  id: string
  source: EventSource
  category: EventCategory
  title: string
  description?: string
  importance: number
  isPinned: boolean
  eventDate: string // yyyy-MM-dd
  eventTime: string // ISO
  repo?: string // which repo this came from (GitHub-synced events)
}

export interface DailyLog {
  id: string
  logDate: string
  whatIBuilt: string
  whatBlockedMe: string
  whatILearned: string
  energyLevel: number
  mood: Mood
}

export interface AchievementDef {
  code: string
  name: string
  description: string
  icon: string
  xp: number
  rarity: Rarity
  threshold: number
  metric: 'total_events' | 'streak_days' | 'total_commits' | 'daily_logs' | 'content_pieces' | 'revenue_events' | 'level'
}

export interface ContentPiece {
  id: string
  platform: ContentPlatform
  tone: Tone
  title: string
  body: string
  status: 'draft' | 'scheduled' | 'published'
  createdAt: string
}

export interface ChangelogEntry {
  id: string
  versionTag: string
  title: string
  body: string
  publishedAt: string
}

export interface Profile {
  username: string
  displayName: string
  email?: string       // from auth — receipts + n8n follow-ups
  avatar?: string      // emoji face for the builder
  avatarUrl?: string   // real avatar image (tech portrait / robot / pixel)
  avatarHue?: number   // gradient hue for the avatar ring
  // Where their story starts — newbies log day 1, veterans log the climb
  startStage?: 'spark' | 'building' | 'launched'
  onboarded?: boolean  // finished the first-run questions
  tourDone?: boolean   // seen the guided walkthrough
  bio: string
  projectName: string
  projectTagline: string
  website: string
  twitter: string
  github: string
  tone: Tone
  theme?: 'dark' | 'light'
  tier?: 'free' | 'pro' | 'team'
  // What they bought is `tier`; whether it still counts is `planExpiresAt`.
  // Without this an expired plan never lapses — see plan.ts planState().
  planExpiresAt?: string
  planStartedAt?: string
  planCycle?: 'monthly' | 'yearly'
  streakCurrent: number
  streakLongest: number
  builderScore: number
  totalShips: number
}

export const CATEGORY_META: Record<EventCategory, { label: string; color: string; bg: string }> = {
  commit:      { label: 'Commit',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  deployment:  { label: 'Deploy',      color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  feature:     { label: 'Feature',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  bugfix:      { label: 'Bugfix',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  revenue:     { label: 'Revenue',     color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  customer:    { label: 'Customer',    color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  milestone:   { label: 'Milestone',   color: '#fcd34d', bg: 'rgba(252,211,77,0.14)' },
  learning:    { label: 'Learning',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  blocker:     { label: 'Blocker',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  idea:        { label: 'Idea',        color: '#e879f9', bg: 'rgba(232,121,249,0.12)' },
  launch:      { label: 'Launch',      color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  integration: { label: 'Integration', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  design:      { label: 'Design',      color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  content:     { label: 'Content',     color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  other:       { label: 'Other',       color: '#8888a0', bg: 'rgba(136,136,160,0.12)' },
}

export const SOURCE_LABEL: Record<EventSource, string> = {
  github: 'GitHub', vercel: 'Vercel', stripe: 'Stripe', linear: 'Linear',
  supabase: 'Supabase', notion: 'Notion', slack: 'Slack', discord: 'Discord',
  n8n: 'n8n', manual: 'Manual', ai_detected: 'AI',
}

export function levelForXP(xp: number): { level: number; name: string; into: number; needed: number } {
  // 500 XP per level, simple and legible
  const level = Math.max(1, Math.floor(xp / 500) + 1)
  const names: [number, string][] = [
    [1, 'Ideator'], [3, 'Prototyper'], [5, 'Shipper'], [7, 'Builder'],
    [10, 'Machine'], [12, 'Velocity Founder'], [15, 'Legendary Founder'],
  ]
  let name = 'Ideator'
  for (const [lv, n] of names) if (level >= lv) name = n
  return { level, name, into: xp % 500, needed: 500 }
}
