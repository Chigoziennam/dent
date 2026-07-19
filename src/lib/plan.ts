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
  aiPerWeek: number             // writer generations (free tier resets weekly)
  aiPerMonth: number            // writer ceiling on paid tiers
  chatPerDay: number            // co-pilot messages — its own budget, resets daily
  manualEventsPerMonth: number  // Infinity once paid — GitHub imports are exempt
  humanWriter: boolean          // "Raw notes → Human" writer mode
  proPlatforms: boolean         // Product Hunt + Resume outputs
}

// Why these numbers and not "unlimited":
// Every generation is a real OpenRouter call. Measured cost is ~$0.0147 per
// writer post (Sonnet, ~2.4k in / 500 out) and ~$0.0016 per co-pilot message
// (Haiku, after the chat context trim). Unlimited on a $9 plan meant a heavy
// user cost more than they paid — we lost most on the users least likely to
// churn. These caps are set so that a user who maxes EVERY day still leaves
// margin (Pro worst case ≈ $5.18/mo against $9), while sitting far enough
// above real usage that nobody normal ever sees them. Same shape as Claude's
// own limits: a ceiling that bounds abuse, not a meter that nags.
// NOTE: team's worst case is ≈ $17.25/mo — it needs to be priced at $29+.
export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: { aiPerWeek: 7,   aiPerMonth: 28,  chatPerDay: 15,  manualEventsPerMonth: 30,       humanWriter: false, proPlatforms: false },
  pro:  { aiPerWeek: 60,  aiPerMonth: 150, chatPerDay: 60,  manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: false },
  team: { aiPerWeek: 200, aiPerMonth: 500, chatPerDay: 200, manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: true  },
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
