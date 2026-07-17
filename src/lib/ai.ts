import type { ShipEvent, DailyLog, ContentPlatform, Tone, EventCategory } from './types'
import { CATEGORY_META } from './types'

// Works in two modes:
//  1. Demo mode (default): crafted templates fed by real event data — instant, offline.
//  2. Live mode: if VITE_ANTHROPIC_API_KEY is set, calls the Anthropic API.
//     TODO(production): route through a Supabase Edge Function, never ship the key client-side.

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
const N8N_BASE = (import.meta.env.VITE_N8N_WEBHOOK_BASE as string | undefined)?.replace(/\/$/, '')

// Alive mode: route through your own n8n instance, which holds the real
// Anthropic key server-side and can log usage. One webhook, every feature.
async function callN8n(task: string, payload: Record<string, unknown>): Promise<string | null> {
  if (!N8N_BASE) return null
  try {
    const res = await fetch(`${N8N_BASE}/shiplog-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, ...payload }),
      // n8n can hang forever if the workflow isn't active — never let the UI
      // wait on it. 12s is enough for a real Claude answer through n8n.
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.text === 'string' ? data.text : null
  } catch {
    return null
  }
}

// Style DNA distilled from what actually performs in #buildinpublic —
// raw numbers beat polish, honesty beats hype, the STORY behind the ship wins.
const SYSTEM_PROMPT = `You are Super Dent X AI, ghost-writing for a founder who builds in public.
The post is about the WORK — the actual ships — not the product's name. Lead with what was built and the story behind it; the project name is a supporting detail, never the headline, and never repeated like a slogan.

Rules that make it read like a real builder, not a marketer:
- THE STORY IS THE POINT. Every ship has a "why it mattered" — the bug that took 3 days, the deploy that finally went green, the feature a user begged for. Use the builder's own notes/details as the emotional core. Make it feel earned, alive, a little bit proud.
- CONNECT RELATED SHIPS. If there's a commit AND a deploy (or a fix AND a release) close together, tell it as ONE arc: "wrote it, shipped it, it's live" — not two bullet points. Analyze precisely what actually happened.
- RAW NUMBERS FIRST when they exist: "₦47k MRR, lost 2 users, onboarding is broken" beats any polished line. Money and user counts lead.
- HONESTY > HYPE: the hard part, the blocker, the thing that fought back — keep it. That's what earns replies.
- Anchor with the day count / streak when it adds weight ("day 47 of this").
- Tweets ≤ 280 chars or a clean numbered thread. LinkedIn 800–1200 chars, human. Newsletter/blog can breathe.
- NEVER open with "🚀 Exciting news!", "I'm thrilled to announce", "Delve", or any AI tell. Max 1 hashtag. No emoji soup.
- Sound like the founder typed it on their phone right after the work, still a bit hyped or a bit wrecked. Passion over polish.`

interface GenParams {
  events: ShipEvent[]
  dailyLogs: DailyLog[]
  platform: ContentPlatform
  tone: Tone
  projectName: string
  projectTagline: string
}

export async function generateContent(p: GenParams): Promise<string> {
  const a = analyzeShips(p.events)
  const alive = await callN8n('generate', {
    platform: p.platform, tone: p.tone, projectName: p.projectName, projectTagline: p.projectTagline,
    // detail carries the note/proof/effort the builder typed — this is what
    // turns "generic AI post" into receipts with real numbers.
    events: p.events.map(e => ({ category: e.category, title: e.title, date: e.eventDate, detail: e.description?.slice(0, 240) })),
    dailyLogs: p.dailyLogs.map(l => ({ date: l.logDate, built: l.whatIBuilt, learned: l.whatILearned, blocked: l.whatBlockedMe, energy: l.energyLevel })),
    // Pre-chewed analysis so the model tells ONE precise story (e.g. commit+deploy = one arc).
    analysis: { combos: a.combos, counts: a.counts, money: a.money, headline: a.headline ? cleanTitle(a.headline.title) : null, stories: a.stories },
  })
  if (alive) return alive
  if (API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Context (project, for reference only — do NOT make it the headline): ${p.projectName} — ${p.projectTagline}

The ships to write about:
${p.events.map(e => `- [${e.category}] ${e.title} (${e.eventDate})${e.description ? ` — ${e.description.slice(0, 160).replace(/\n/g, '; ')}` : ''}`).join('\n')}
${a.combos.length ? `\nWhat connects: ${a.combos.join('; ')} — tell these as ONE arc, not separate bullets.` : ''}${a.money ? `\nMoney/customer: ${a.money} — lead with this.` : ''}

Daily reflections:
${p.dailyLogs.map(l => `${l.logDate}: Built: ${l.whatIBuilt}. Learned: ${l.whatILearned}`).join('\n')}

Write a ${p.platform} post in ${p.tone} voice. Center it on the WORK and the story behind it. Real, specific, a little proud. The project name is background, not the hook.`,
          }],
        }),
      })
      const data = await res.json()
      if (data?.content?.[0]?.text) return data.content[0].text
    } catch { /* fall through to demo mode */ }
  }
  // Simulate thinking time so the typewriter feels alive
  await new Promise(r => setTimeout(r, 600))
  return template(p)
}

function cleanTitle(t: string): string {
  return t.replace(/^(feat|fix|chore|refactor|perf|docs|style|test)(\([^)]*\))?:\s*/i, '').trim()
}

// The "story behind it" — the human note the builder typed, stripped of the
// scaffolding lines (Belongs to / Effort / Link) and the gh boilerplate.
function extractStory(e: ShipEvent): string | null {
  if (!e.description) return null
  const first = e.description.split('\n')
    .map(l => l.trim())
    .find(l => l && !/^(belongs to|effort|link):/i.test(l) && !/^`?[0-9a-f]{7}`?\s*·/.test(l))
  return first && first.length > 3 ? first : null
}

// Pull a money figure out of a title/note if the builder wrote one.
function moneyLine(events: ShipEvent[]): string | null {
  const m = events.find(e => e.category === 'revenue' || e.category === 'customer')
  if (!m) return null
  const story = extractStory(m)
  return story ? `${cleanTitle(m.title)} — ${story}` : cleanTitle(m.title)
}

export interface ShipAnalysis {
  events: ShipEvent[]
  counts: Record<string, number>
  headline: ShipEvent | null
  stories: { title: string; story: string; category: EventCategory }[]
  combos: string[]
  days: number
  money: string | null
}

// Precise analysis of a set of ships: what got built, what connects to what,
// and the stories worth telling. This is what lets a commit + a deploy become
// ONE narrative instead of two dead bullets.
export function analyzeShips(events: ShipEvent[]): ShipAnalysis {
  const counts = countBy(events)
  const sorted = [...events].sort((a, b) => b.importance - a.importance || b.eventTime.localeCompare(a.eventTime))
  const headline = sorted[0] ?? null
  const stories = sorted
    .map(e => { const s = extractStory(e); return s ? { title: cleanTitle(e.title), story: s, category: e.category } : null })
    .filter((x): x is { title: string; story: string; category: EventCategory } => !!x)
    .slice(0, 4)

  // Same-day category combinations → a real sentence about the arc.
  const byDay = new Map<string, Set<EventCategory>>()
  for (const e of events) {
    if (!byDay.has(e.eventDate)) byDay.set(e.eventDate, new Set())
    byDay.get(e.eventDate)!.add(e.category)
  }
  const combos: string[] = []
  for (const cats of byDay.values()) {
    if (cats.has('commit') && cats.has('deployment')) combos.push('wrote the code and pushed it live the same day')
    else if (cats.has('bugfix') && cats.has('deployment')) combos.push('killed the bug and shipped the fix to prod')
    else if (cats.has('feature') && cats.has('deployment')) combos.push('built it and put it straight in front of users')
    else if (cats.has('feature') && cats.has('commit')) combos.push('turned a pile of commits into a real feature')
  }

  return {
    events,
    counts,
    headline,
    stories,
    combos: [...new Set(combos)].slice(0, 2),
    days: byDay.size,
    money: moneyLine(events),
  }
}

// A tight, story-first bullet for a ship — title + the why, when we have it.
function shipLine(e: ShipEvent): string {
  const story = extractStory(e)
  const title = cleanTitle(e.title)
  return story ? `→ ${title} — ${story}` : `→ ${title}`
}

function template(p: GenParams): string {
  const a = analyzeShips(p.events)
  const top = a.events.slice().sort((x, y) => y.importance - x.importance).slice(0, 4)
  const bullets = top.map(shipLine)
  const counts = a.counts
  const learned = p.dailyLogs.find(l => l.whatILearned)?.whatILearned
  const blocked = p.dailyLogs.find(l => l.whatBlockedMe)?.whatBlockedMe
  const combo = a.combos[0]
  const headStory = a.headline ? extractStory(a.headline) : null
  const numbers = `${counts.commit ?? 0} commits · ${counts.deployment ?? 0} deploys${a.money ? ` · 💰 ${a.money}` : ''}`

  switch (p.platform) {
    case 'twitter': {
      if (p.tone === 'technical') {
        return `${combo ? `Today I ${combo}.\n\n` : ''}${bullets.join('\n')}\n\n${counts.commit ?? 0} commits, ${counts.deployment ?? 0} deploys.${blocked ? ` What fought back: ${blocked.slice(0, 80)}.` : ''} ${learned ? `Lesson: ${learned}` : ''}`.trim()
      }
      if (p.tone === 'storytelling') {
        return `${headStory ? `${headStory}\n\n` : combo ? `${cap(combo)}.\n\n` : ''}${bullets.join('\n')}\n\n${a.money ? `And the receipts landed: ${a.money}.\n\n` : ''}This is the part nobody sees — so I'm writing it down.`.trim()
      }
      if (p.tone === 'hype') {
        return `${combo ? `${cap(combo)} 🔥\n\n` : 'big one today 🔥\n\n'}${bullets.join('\n')}\n\n${a.money ? `${a.money} ✅\n` : ''}${numbers}\n\nwe do not stop.`.trim()
      }
      if (p.tone === 'mentor') {
        return `A real day of building:\n\n${bullets.join('\n')}\n\n${combo ? `The lesson in it: ${combo} — shipping beats hoarding half-done work. ` : ''}${learned ? `Biggest takeaway: ${learned}` : 'Show up again tomorrow.'}`.trim()
      }
      if (p.tone === 'unfiltered') {
        return `no polish:\n\n${bullets.join('\n')}\n\n${blocked ? `${blocked.slice(0, 70).toLowerCase()} nearly won. ` : ''}${combo ? `${combo} anyway. ` : ''}shipped.`.trim()
      }
      // founder default — story first, numbers as proof
      return `${headStory ? `${headStory}\n\n` : combo ? `${cap(combo)}.\n\n` : ''}${bullets.join('\n')}\n\n📊 ${numbers}\n\n${learned ? `Lesson: ${learned}` : blocked ? `Still fighting: ${blocked.slice(0, 60)}` : 'Small steps. Still counts.'}`.trim()
    }
    case 'linkedin': {
      if (p.tone === 'storytelling') {
        return `${headStory ? `${headStory}\n\n` : ''}Here's what actually happened:\n\n${bullets.join('\n')}\n\n${combo ? `The best part: I ${combo} — that loop, tight and shipped, is the whole game.\n\n` : ''}${learned ? `The lesson that stuck: ${learned}\n\n` : ''}Building in public means showing the work, not the pitch.\n\nWhat did you ship this week?`.trim()
      }
      return `${combo ? `Today I ${combo}.` : 'Progress update from the build.'}\n\n${bullets.join('\n')}\n\nThe numbers behind it: ${numbers}.\n\n${learned ? `One thing I learned: ${learned}` : 'Momentum is the moat.'}`.trim()
    }
    case 'newsletter': {
      return `## What got built${a.days > 1 ? ` (${a.days} days)` : ' today'}\n\n${combo ? `The short version: I ${combo}. The longer version:\n\n` : ''}${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${learned ? `**What I learned:** ${learned}\n\n` : ''}**By the numbers:** ${numbers}\n\nThanks for following along.`.trim()
    }
    case 'changelog': {
      return `${top.map(e => `- **${CATEGORY_META[e.category].label}:** ${cleanTitle(e.title)}`).join('\n')}\n\n*${p.events.length} changes${a.days > 1 ? ` across ${a.days} days` : ' today'}.*`
    }
    case 'threads':
      return `${headStory ? `${headStory}\n\n` : combo ? `${cap(combo)}.\n\n` : ''}${bullets.join('\n')}\n\nBuilding in public, one ship at a time.`.trim()
    case 'devto':
      return `## Build log${a.days > 1 ? ` — last ${a.days} days` : ' — today'}\n\n${combo ? `I ${combo}. Here's the breakdown:\n\n` : ''}${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${numbers}. ${learned ? `Biggest lesson: ${learned}` : ''}`.trim()
    case 'producthunt':
      return `What just shipped:\n\n${bullets.join('\n')}\n\n${combo ? `${cap(combo)}. ` : ''}Shipping in public — feedback welcome.`.trim()
    case 'resume':
      return top.map(e => `• ${cap(cleanTitle(e.title))}`).join('\n')
    case 'blog': {
      return `# ${a.headline ? cap(cleanTitle(a.headline.title)) : 'A day in the log'}\n\n${headStory ?? p.projectTagline}\n\n${combo ? `Today I ${combo}. ` : ''}Here's what made it into the log:\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${learned ? `## What I learned\n\n${learned}\n\n` : ''}## Why I log everything\n\nBy Friday I used to forget what Monday looked like. Now every commit, deploy and conversation lands in one timeline — and posts like this write themselves from the raw material.`.trim()
    }
  }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── The Humanizer ─────────────────────────────────────────────
// Takes raw builder notes and reshapes them into a post that reads
// like a person, not a press release: short sentences, concrete
// details kept, filler stripped, no AI-sounding openers.
export async function humanize(raw: string, platform: ContentPlatform, tone: Tone, projectName: string): Promise<string> {
  const alive = await callN8n('humanize', { raw, platform, tone, projectName })
  if (alive) return alive
  if (API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT + `\n\nExtra rules for humanizing:
- The user gives you raw, messy notes. Keep their facts and voice, tighten everything else.
- Short sentences. Concrete numbers. No hashtags unless they used them.
- Never sound like AI: no "delve", no "exciting news", no bullet-point sandwiches unless the platform wants them.
- It should read like the founder typed it on their phone after a good day.`,
          messages: [{
            role: 'user',
            content: `Project: ${projectName}\nPlatform: ${platform}\nVoice: ${tone}\n\nMy raw notes:\n${raw}\n\nTurn this into a post. Keep it human.`,
          }],
        }),
      })
      const data = await res.json()
      if (data?.content?.[0]?.text) return data.content[0].text
    } catch { /* fall through */ }
  }
  await new Promise(r => setTimeout(r, 500))
  return humanizeTemplate(raw, platform, tone, projectName)
}

function humanizeTemplate(raw: string, platform: ContentPlatform, tone: Tone, projectName: string): string {
  // Split notes into clean fragments
  const lines = raw
    .split(/\n|(?<=[.!?])\s+/)
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 2)
  const points = lines.slice(0, 5)
  const opener = {
    founder: ['Quick update from the trenches.', 'Real talk from today\'s session:', 'Today\'s log, unfiltered:'],
    technical: ['Notes from today\'s build:', 'What actually happened in the codebase today:', 'Today\'s engineering log:'],
    storytelling: ['Today had a moment worth writing down.', 'Some days the work tells its own story. Today:', 'Here\'s how today actually went.'],
    hype: ['LET\'S GO. Today delivered:', 'Big day in the workshop:', 'The momentum is REAL today:'],
    mentor: ['A few things today taught me, sharing in case they help:', 'If you\'re earlier on this road, today\'s notes:', 'Lessons from today\'s session:'],
    unfiltered: ['No polish, here\'s today:', 'The honest log, typos and all:', 'What today actually looked like:'],
  }[tone][raw.length % 3]

  switch (platform) {
    case 'twitter':
    case 'threads':
      return `${opener}\n\n${points.map(p => `${p}`).join('\n\n')}\n\nBack at it tomorrow. ${projectName} won't build itself.`
    case 'linkedin':
      return `${opener}\n\n${points.join('. ')}.\n\nNone of this is glamorous. That's the point — real progress rarely is. Building ${projectName} one honest day at a time.\n\nWhat did you ship this week?`
    case 'devto':
      return `## ${projectName}: today's build notes\n\n${points.map(p => `- ${p}`).join('\n')}\n\nWritten as it happened — no retrospective polish. If you're building something similar, the comments are open.`
    case 'producthunt':
      return `${projectName} — today's changelog for the curious:\n\n${points.map(p => `→ ${p}`).join('\n')}\n\nShipping in public, one day at a time. Feedback always welcome.`
    case 'resume':
      return points.map(p => `• ${p.charAt(0).toUpperCase() + p.slice(1).replace(/\.$/, '')} — delivered as part of ${projectName}`).join('\n')
    case 'newsletter':
      return `${opener}\n\n${points.map(p => `- ${p}`).join('\n')}\n\nThat's the honest version. See you in the next one.`
    default:
      return `${opener}\n\n${points.map(p => `- ${p}`).join('\n')}`
  }
}

// ── Fusion mode ───────────────────────────────────────────────
// Merges hand-picked ship events with the builder's raw current
// state into one draft: the facts from the log, the mood from the
// human, fused into the ultimate message.
export async function fuse(params: {
  picked: ShipEvent[]
  state: string
  platform: ContentPlatform
  tone: Tone
  projectName: string
}): Promise<string> {
  const { picked, state, platform, tone, projectName } = params
  const alive = await callN8n('fuse', {
    state, platform, tone, projectName,
    picked: picked.map(e => ({ category: e.category, title: e.title, date: e.eventDate, detail: e.description?.slice(0, 240) })),
  })
  if (alive) return alive
  if (API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Project: ${projectName}\nPlatform: ${platform}\nVoice: ${tone}\n\nShips I picked from my log:\n${picked.map(e => `- [${e.category}] ${e.title} (${e.eventDate})`).join('\n')}\n\nHow I actually feel right now, raw:\n${state}\n\nFuse both into one ${platform} post: my logged facts + my current state. It must read like me on a real day, not a highlight reel.`,
          }],
        }),
      })
      const data = await res.json()
      if (data?.content?.[0]?.text) return data.content[0].text
    } catch { /* fall through */ }
  }
  await new Promise(r => setTimeout(r, 600))
  const bullets = picked.map(e => `→ ${e.title.replace(/^(feat|fix|chore|refactor|perf): /, '')}`)
  const feeling = state.trim().split(/\n/)[0] ?? ''
  const openers = {
    founder: feeling ? `${feeling.replace(/\.$/, '')}. Here's what the log says I actually did:` : `The log doesn't lie. This period:`,
    technical: `State of the build${feeling ? ` (${feeling.toLowerCase().replace(/\.$/, '')})` : ''}:`,
    storytelling: feeling ? `${feeling.replace(/\.$/, '')} — and yet, the work moved:` : `Some weeks you only see the progress when you read it back:`,
    hype: feeling ? `${feeling.replace(/\.$/, '')} — AND LOOK AT THIS LIST:` : `The scoreboard doesn't lie:`,
    mentor: feeling ? `${feeling.replace(/\.$/, '')}. For anyone building alongside me, here's the week:` : `For anyone earlier on this path, here's what a real week looks like:`,
    unfiltered: feeling ? `${feeling.replace(/\.$/, '')}. anyway, receipts:` : `no intro, just the receipts:`,
  }
  const closers = {
    founder: `That's ${projectName}, one honest day at a time.`,
    technical: `${picked.length} entries from the log. Consistency is the architecture.`,
    storytelling: `Future me will read this back and remember exactly how it felt.`,
    hype: `${projectName} is not slowing down. Strap in. 🚀`,
    mentor: `None of this needed genius — just showing up again. You can do the same.`,
    unfiltered: `that's it. back to the terminal.`,
  }
  switch (platform) {
    case 'linkedin':
      return `${openers[tone]}\n\n${bullets.join('\n')}\n\n${state.trim() ? `The honest part: ${state.trim()}\n\n` : ''}${closers[tone]}\n\nWhat did you ship this week?`
    case 'newsletter':
      return `## The log vs. how it felt\n\n${openers[tone]}\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${state.trim() ? `Between the lines: ${state.trim()}\n\n` : ''}${closers[tone]}`
    default:
      return `${openers[tone]}\n\n${bullets.join('\n')}\n\n${closers[tone]}`
  }
}

// ── Copy & open: paste-ready posting ─────────────────────────
// Copies the post, then opens the platform's compose surface —
// prefilled where the platform allows it, paste-ready everywhere else.
export function composeUrl(platform: ContentPlatform, body: string): { url: string; prefills: boolean } {
  const t = encodeURIComponent(body)
  switch (platform) {
    case 'twitter': return { url: `https://x.com/intent/post?text=${t}`, prefills: true }
    case 'threads': return { url: `https://www.threads.net/intent/post?text=${t}`, prefills: true }
    case 'linkedin': return { url: `https://www.linkedin.com/feed/?shareActive=true&text=${t}`, prefills: true }
    case 'devto': return { url: 'https://dev.to/new', prefills: false }
    case 'producthunt': return { url: 'https://www.producthunt.com/posts/new', prefills: false }
    default: return { url: '', prefills: false }
  }
}

// ── Shipper wisdom — short words from people who ship ─────────
export const SHIPPER_QUOTES: { text: string; who: string }[] = [
  { text: 'When something is important enough, you do it even if odds are against you.', who: 'Elon Musk' },
  { text: 'Real artists ship.', who: 'Steve Jobs' },
  { text: 'Make something people want.', who: 'Paul Graham' },
  { text: 'Play long-term games with long-term people.', who: 'Naval Ravikant' },
  { text: 'Done is better than perfect.', who: 'Sheryl Sandberg' },
  { text: 'The days are long but the decades are short.', who: 'Sam Altman' },
  { text: 'Launch now, polish later.', who: 'Pieter Levels' },
  { text: 'Ship early, ship often.', who: 'builder proverb' },
]

// ── The Co-pilot ──────────────────────────────────────────────
// A floating companion that has read the whole log. Tries the n8n
// brain first (real Claude); falls back to a local engine that
// answers from the store: search, stats, motivation.
export interface CopilotContext {
  events: ShipEvent[]
  dailyLogs: DailyLog[]
  streak: number
  projectName: string
  displayName: string
}

// Which brain is answering? The UI shows this so "automated" is never a mystery.
export function aiMode(): 'n8n' | 'direct' | 'local' {
  if (N8N_BASE) return 'n8n'
  if (API_KEY) return 'direct'
  return 'local'
}

async function copilotRemote(question: string, ctx: CopilotContext): Promise<string | null> {
  const alive = await callN8n('chat', {
    question,
    projectName: ctx.projectName,
    streak: ctx.streak,
    events: ctx.events.slice(0, 60).map(e => ({ category: e.category, title: e.title, date: e.eventDate, detail: e.description?.slice(0, 240) })),
    dailyLogs: ctx.dailyLogs.slice(0, 14).map(l => ({ date: l.logDate, built: l.whatIBuilt, learned: l.whatILearned, blocked: l.whatBlockedMe, mood: l.mood, energy: l.energyLevel })),
  })
  if (alive) return alive
  // Direct Claude fallback: real AI the moment VITE_ANTHROPIC_API_KEY exists.
  // TODO(production): retire this path once the n8n brain is live — key belongs server-side.
  if (API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: `You are the Super Dent X Co-pilot for ${ctx.displayName}, a founder building ${ctx.projectName}. You have their full shipping log. Be a real companion: specific, warm, brief (2-4 sentences), reference their actual events by name and date. Motivate with receipts, never generic hype. If asked "when did I X", answer from the events list.`,
          messages: [{
            role: 'user',
            content: `My streak: ${ctx.streak} days.\nMy recent events:\n${ctx.events.slice(0, 60).map(e => `- ${e.eventDate} [${e.category}] ${e.title}${e.description ? ` — ${e.description.slice(0, 160).replace(/\n/g, '; ')}` : ''}`).join('\n')}\n\nRecent reflections:\n${ctx.dailyLogs.slice(0, 10).map(l => `${l.logDate}: built ${l.whatIBuilt}; learned ${l.whatILearned}`).join('\n')}\n\nMy question: ${question}`,
          }],
        }),
      })
      const data = await res.json()
      if (data?.content?.[0]?.text) return data.content[0].text
    } catch { /* fall through to local engine */ }
  }
  return null
}

export async function copilotAnswer(question: string, ctx: CopilotContext): Promise<string> {
  const remote = await copilotRemote(question, ctx)
  if (remote) return remote
  await new Promise(r => setTimeout(r, 350))
  return localAnswer(question, ctx)
}

// ── Proactive briefing — the co-pilot speaks FIRST ────────────
// Rides the same n8n `chat` task, so no server changes needed;
// the local twin composes a data-driven brief when offline.
const BRIEF_QUESTION = 'Open the conversation with a short proactive briefing (you speak first, I asked nothing): greet me by name, sum up today and this week from my real events — actual titles and numbers — flag yesterday\'s blocker if there was one, and end with the single most valuable next move. 4 sentences max, warm but zero fluff.'

export async function copilotBriefing(ctx: CopilotContext): Promise<string> {
  const remote = await copilotRemote(BRIEF_QUESTION, ctx)
  if (remote) return remote
  await new Promise(r => setTimeout(r, 450))
  return localBriefing(ctx)
}

function localBriefing(ctx: CopilotContext): string {
  const today = new Date().toISOString().slice(0, 10)
  const todays = ctx.events.filter(e => e.eventDate === today)
  const week = ctx.events.filter(e => e.eventDate >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10))
  const lastLog = ctx.dailyLogs[0]
  const hour = new Date().getHours()
  const opener = hour < 12 ? 'Morning briefing' : hour < 17 ? 'Afternoon check-in' : 'Evening debrief'
  const lines = [
    `${opener}, ${ctx.displayName}. Here's where ${ctx.projectName} stands:`,
    todays.length === 0
      ? `• Nothing logged yet today — the ${ctx.streak}-day streak is hungry.`
      : `• ${todays.length} ship${todays.length > 1 ? 's' : ''} today — latest: “${todays[0].title}”.`,
    `• ${week.length} ships this week · ${ctx.events.length} lifetime.`,
  ]
  if (lastLog?.whatBlockedMe) lines.push(`• Last session's wall: “${lastLog.whatBlockedMe.slice(0, 70)}” — worth attacking first.`)
  lines.push(todays.length === 0 ? 'Smallest valuable thing first. Ship it, log it — I\'ll see it the second you do.' : 'Momentum is real. What are we shipping next?')
  return lines.join('\n')
}

function localAnswer(question: string, ctx: CopilotContext): string {
  const q = question.toLowerCase().trim()
  const today = new Date().toISOString().slice(0, 10)
  const todays = ctx.events.filter(e => e.eventDate === today)
  const week = ctx.events.filter(e => e.eventDate >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10))
  const quote = SHIPPER_QUOTES[question.length % SHIPPER_QUOTES.length]

  // Memory search: "when did I ..." / "find ..." / "search ..."
  const searchMatch = q.match(/(?:when did i|find|search|did i)\s+(.+)/)
  if (searchMatch) {
    const terms = searchMatch[1].replace(/[?.!]/g, '').split(/\s+/).filter(w => w.length > 2)
    const hits = ctx.events.filter(e => terms.some(t => e.title.toLowerCase().includes(t) || e.description?.toLowerCase().includes(t))).slice(0, 4)
    if (hits.length === 0) return `I searched the whole log — nothing matching "${terms.join(' ')}" yet. When you ship it, I'll remember it.`
    return `Found it in the log:\n${hits.map(h => `• ${h.eventDate} — ${h.title}`).join('\n')}`
  }

  if (/streak/.test(q)) {
    return `You're on a ${ctx.streak}-day streak. ${ctx.streak >= 21 ? 'That is elite territory — most people never see week two.' : 'Every day you show up, it gets harder to stop.'} One ship today keeps it breathing.`
  }
  if (/week|progress|how am i|how's it going|hows it going/.test(q)) {
    const cats = week.reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] ?? 0) + 1; return a }, {})
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${n} ${c}s`).join(', ')
    return `This week: ${week.length} ships — ${top || 'quiet so far'}. Today: ${todays.length}. ${week.length > 20 ? 'You are genuinely cooking.' : 'Room to push — pick the smallest task on ' + ctx.projectName + ' and ship it.'}`
  }
  if (/motivat|tired|hard|give up|stuck|burn/.test(q)) {
    return `"${quote.text}" — ${quote.who}\n\nAnd here's your own receipt, ${ctx.displayName}: ${ctx.events.length} things shipped, ${ctx.streak} days straight. You've already survived every hard day so far. Ship one small thing, then rest.`
  }
  if (/what (should|do) i (do|work|ship)/.test(q)) {
    const lastLog = ctx.dailyLogs[0]
    return lastLog?.whatBlockedMe
      ? `Yesterday you said this fought back: "${lastLog.whatBlockedMe}". Slay that first — blocked work compounds. Then log it and I'll celebrate with you.`
      : `Smallest valuable thing wins. Open ${ctx.projectName}, find a 30-minute task, ship it, log it. Momentum does the rest.`
  }
  // Default: state of the log
  return `Here's where you stand: ${todays.length} ships today, ${week.length} this week, ${ctx.streak}-day streak, ${ctx.events.length} lifetime. Ask me "when did I …", "how's my week", or just tell me you're tired — I've read the whole log.`
}

function countBy(events: ShipEvent[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) out[e.category] = (out[e.category] ?? 0) + 1
  return out
}
