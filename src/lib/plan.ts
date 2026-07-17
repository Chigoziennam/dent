// ── Plan entitlements — one source of truth for what each tier can do ──
// The Pricing page sells these limits; this file is what actually enforces
// them across the app so existing users are held to the plan they're on.
//   Free    → 2 AI generations / week, 30 manual events / month, GitHub only
//   Pro     → unlimited AI + events, Raw-notes→Human writer
//   CEO/team → everything in Pro + Product Hunt & Resume outputs
import type { Profile, ContentPlatform } from './types'

export type Tier = 'free' | 'pro' | 'team'

export const tierOf = (p?: Profile | null): Tier => (p?.tier ?? 'free')
export const TIER_LABEL: Record<Tier, string> = { free: 'Free', pro: 'Pro', team: 'CEO Mode' }

export interface Entitlements {
  aiPerWeek: number             // Infinity once paid
  manualEventsPerMonth: number  // Infinity once paid — GitHub imports are exempt
  humanWriter: boolean          // "Raw notes → Human" writer mode
  proPlatforms: boolean         // Product Hunt + Resume outputs
}

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: { aiPerWeek: 2,        manualEventsPerMonth: 30,       humanWriter: false, proPlatforms: false },
  pro:  { aiPerWeek: Infinity, manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: false },
  team: { aiPerWeek: Infinity, manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: true  },
}

export const entitlementsFor = (p?: Profile | null): Entitlements => ENTITLEMENTS[tierOf(p)]

// Platforms that require CEO Mode (team). Everything else is open.
export const PRO_PLATFORMS: ContentPlatform[] = ['producthunt', 'resume']
export const platformAllowed = (platform: ContentPlatform, p?: Profile | null): boolean =>
  !PRO_PLATFORMS.includes(platform) || entitlementsFor(p).proPlatforms

// The minimum tier that unlocks a platform — for upgrade copy.
export const platformTier = (platform: ContentPlatform): Tier =>
  PRO_PLATFORMS.includes(platform) ? 'team' : 'free'

// Monday-anchored week key (weekly AI reset) and month key (event cap).
export function weekKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const mondayOffset = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - mondayOffset)
  return dt.toISOString().slice(0, 10)
}
export const monthKey = (d = new Date()): string => d.toISOString().slice(0, 7)
