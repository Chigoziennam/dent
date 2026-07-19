// ── Plan entitlements — one source of truth for what each tier can do ──
// The Pricing page sells these limits; this file is what actually enforces
// them across the app so existing users are held to the plan they're on.
//   Free → 5 AI posts/week, 8 co-pilot msgs/day, 30 manual events/month
//   Pro  → 100 AI posts/month, 30 co-pilot msgs/day, unlimited events,
//          Raw-notes→Human writer, Resume + Product Hunt outputs
import type { Profile, ContentPlatform } from './types'

export type Tier = 'free' | 'pro' | 'team'

// What they BOUGHT. Not necessarily what they still have — see tierOf.
export const purchasedTier = (p?: Profile | null): Tier => (p?.tier ?? 'free')

// Three days after expiry the plan still works. Cards fail for boring reasons
// — an expired card, a bank flagging a foreign charge — and locking someone
// out the same hour their renewal bounced punishes them for their bank's
// behaviour. Long enough to fix it, short enough not to be a free month.
export const GRACE_DAYS = 3

export type PlanState = 'free' | 'active' | 'grace' | 'expired'

export function planState(p?: Profile | null): PlanState {
  if (!p || (p.tier ?? 'free') === 'free') return 'free'
  if (!p.planExpiresAt) return 'active' // legacy row, upgrade-8 backfills these
  const expiry = new Date(p.planExpiresAt).getTime()
  if (Number.isNaN(expiry)) return 'active'
  const now = Date.now()
  if (now <= expiry) return 'active'
  if (now <= expiry + GRACE_DAYS * 864e5) return 'grace'
  return 'expired'
}

// THE tier — what the user actually gets right now. An expired plan collapses
// to free here, which is what closes the "pay once, keep Pro forever" hole:
// checkout used to set tier = 'pro' with nothing that ever unset it.
// Everything downstream (entitlements, platform gates, caps) reads this.
export const tierOf = (p?: Profile | null): Tier => {
  const state = planState(p)
  return state === 'expired' || state === 'free' ? 'free' : (p?.tier ?? 'free')
}

// Days until the plan lapses — negative once it has. For "renews in 4 days"
// and for the grace-period banner.
export function daysLeft(p?: Profile | null): number | null {
  if (!p?.planExpiresAt) return null
  return Math.ceil((new Date(p.planExpiresAt).getTime() - Date.now()) / 864e5)
}
// 'team' is a legacy tier — anyone on it keeps Pro access, labelled as Pro.
export const TIER_LABEL: Record<Tier, string> = { free: 'Free', pro: 'Pro', team: 'Pro' }

export interface Entitlements {
  aiPerWeek: number             // writer generations (free tier resets weekly)
  aiPerMonth: number            // writer ceiling on paid tiers
  chatPerDay: number            // co-pilot messages — its own budget, resets daily
  manualEventsPerMonth: number  // Infinity once paid — GitHub imports are exempt
  humanWriter: boolean          // "Raw notes → Human" writer mode
  proPlatforms: boolean         // Product Hunt + Resume outputs
}

// Why these numbers and not "unlimited":
// Every generation is a real OpenRouter call. Worst-case measured cost is
// ~$0.0215 per writer post (Sonnet, 60-ship context cap, max_tokens 700) and
// ~$0.0029 per co-pilot message (Haiku, after the chat context trim).
// Unlimited on a $9 plan meant a heavy user cost more than they paid — we
// lost most on the users least likely to churn. At these caps a user who
// maxes EVERY day costs ~$4.71/mo against $9 (48% margin), and realistic
// usage lands nearer $0.94 (~90%). Same shape as Claude's own limits: a
// ceiling that bounds abuse, not a meter that nags.
// NOTE: a user's ship count does NOT affect cost — the n8n fetch is capped at
// 60 ships, so someone with 10,000 events costs the same as someone with 60.
//
// ONE paid plan. CEO Mode split the good stuff across two tiers and sold
// things that were never built (custom domain, API access, team dashboard,
// priority support). Pro now includes everything that actually exists,
// including the Resume and Product Hunt outputs CEO Mode used to gate.
// 'team' stays in the type as a legacy alias so anyone already on it keeps
// full access — it maps to the same entitlements as pro.
export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  // Free is a real taste, not a trial: 5 posts a week is enough to feel the
  // writer and build a streak. Chat is the cheap part, so it stays usable.
  free: { aiPerWeek: 5,   aiPerMonth: 20,  chatPerDay: 8,   manualEventsPerMonth: 30,       humanWriter: false, proPlatforms: false },
  // Pro sized like Claude's limits: comfortably above what a daily builder
  // uses (3-4 posts and a handful of co-pilot turns), low enough that the
  // worst case still clears ~60% margin at $12.
  pro:  { aiPerWeek: 35,  aiPerMonth: 100, chatPerDay: 30,  manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: true },
  team: { aiPerWeek: 35,  aiPerMonth: 100, chatPerDay: 30,  manualEventsPerMonth: Infinity, humanWriter: true,  proPlatforms: true },
}

export const entitlementsFor = (p?: Profile | null): Entitlements => ENTITLEMENTS[tierOf(p)]

// Platforms that require a paid plan. Resume and Product Hunt used to be
// CEO-Mode-only; with one paid tier they belong to Pro.
export const PRO_PLATFORMS: ContentPlatform[] = ['producthunt', 'resume']
export const platformAllowed = (platform: ContentPlatform, p?: Profile | null): boolean =>
  !PRO_PLATFORMS.includes(platform) || entitlementsFor(p).proPlatforms

// The minimum tier that unlocks a platform — for upgrade copy.
export const platformTier = (platform: ContentPlatform): Tier =>
  PRO_PLATFORMS.includes(platform) ? 'pro' : 'free'

// Monday-anchored week key (weekly AI reset) and month key (event cap).
export function weekKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const mondayOffset = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - mondayOffset)
  return dt.toISOString().slice(0, 10)
}
export const monthKey = (d = new Date()): string => d.toISOString().slice(0, 7)
