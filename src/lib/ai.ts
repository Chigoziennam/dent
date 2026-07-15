import type { ShipEvent, DailyLog, ContentPlatform, Tone } from './types'
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
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.text === 'string' ? data.text : null
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `You are ShipLog AI, an assistant for founders who build in public.
Rules:
- Sound like a real founder, not a marketer or AI
- Be specific — use actual event data, not generic platitudes
- Keep tweets punchy (max 280 chars or clear thread format)
- LinkedIn posts should be 800-1200 chars, professional but real
- Never start posts with "🚀 Exciting news!" or similar AI-sounding openers
- Include numbers and metrics when available`

interface GenParams {
  events: ShipEvent[]
  dailyLogs: DailyLog[]
  platform: ContentPlatform
  tone: Tone
  projectName: string
  projectTagline: string
}

export async function generateContent(p: GenParams): Promise<string> {
  const alive = await callN8n('generate', {
    platform: p.platform, tone: p.tone, projectName: p.projectName, projectTagline: p.projectTagline,
    events: p.events.map(e => ({ category: e.category, title: e.title, date: e.eventDate })),
    dailyLogs: p.dailyLogs.map(l => ({ date: l.logDate, built: l.whatIBuilt, learned: l.whatILearned })),
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
            content: `Project: ${p.projectName} — ${p.projectTagline}

Events this period:
${p.events.map(e => `- [${e.category}] ${e.title} (${e.eventDate})`).join('\n')}

Daily reflections:
${p.dailyLogs.map(l => `${l.logDate}: Built: ${l.whatIBuilt}. Learned: ${l.whatILearned}`).join('\n')}

Generate a ${p.platform} post in ${p.tone} voice.`,
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

function topEvents(events: ShipEvent[], n = 4): ShipEvent[] {
  return [...events].sort((a, b) => b.importance - a.importance).slice(0, n)
}

function template(p: GenParams): string {
  const top = topEvents(p.events)
  const bullets = top.map(e => `→ ${e.title.replace(/^(feat|fix|chore|refactor|perf): /, '')}`)
  const counts = countBy(p.events)
  const learned = p.dailyLogs.find(l => l.whatILearned)?.whatILearned

  switch (p.platform) {
    case 'twitter': {
      if (p.tone === 'technical') {
        return `Shipped this week on ${p.projectName}:\n\n${bullets.join('\n')}\n\n${counts.commit ?? 0} commits, ${counts.deployment ?? 0} deploys. ${learned ? `Biggest lesson: ${learned}` : 'Consistency compounds.'}`
      }
      if (p.tone === 'storytelling') {
        return `A week ago this didn't exist.\n\nNow ${p.projectName} has:\n${bullets.join('\n')}\n\nBuilding in public, one ship at a time.`
      }
      if (p.tone === 'hype') {
        return `${p.projectName} IS COOKING 🔥\n\n${bullets.join('\n')}\n\n${counts.commit ?? 0} commits. ${counts.deployment ?? 0} deploys. Zero days off.\n\nWe are SO back.`
      }
      if (p.tone === 'mentor') {
        return `A real week of building looks like this:\n\n${bullets.join('\n')}\n\nNot glamorous. Just consistent. ${learned ? `Biggest lesson: ${learned}` : 'Show up again tomorrow.'}`
      }
      if (p.tone === 'unfiltered') {
        return `week recap, no polish:\n\n${bullets.join('\n')}\n\nsome of it fought back. shipped anyway.`
      }
      return `This week I shipped:\n${bullets.join('\n')}\n\nBuilding ${p.projectName} in public. The streak continues. 🔥`
    }
    case 'linkedin': {
      if (p.tone === 'storytelling') {
        return `Every Friday I look back at what actually got built.\n\nThis week on ${p.projectName}:\n\n${bullets.join('\n')}\n\n${learned ? `The lesson that stuck with me: ${learned}\n\n` : ''}When you capture the work as it happens, the story writes itself. That's the whole idea behind building in public — the proof is in the shipping, not the pitch.\n\nWhat did you ship this week?`
      }
      return `Weekly update on ${p.projectName} (${p.projectTagline}):\n\n${bullets.join('\n')}\n\nNumbers: ${p.events.length} events logged, ${counts.commit ?? 0} commits, ${counts.deployment ?? 0} deployments.\n\n${learned ? `One thing I learned: ${learned}` : 'Momentum is the moat.'}`
    }
    case 'newsletter': {
      return `## This week on ${p.projectName}\n\nIt was a shipping week. ${p.events.length} events made it into the log — here's what mattered:\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${learned ? `**What I learned:** ${learned}\n\n` : ''}**By the numbers:** ${counts.commit ?? 0} commits · ${counts.deployment ?? 0} deploys · ${(counts.revenue ?? 0) + (counts.customer ?? 0)} revenue/customer events\n\nNext week: more of the same, but faster. Thanks for following along.`
    }
    case 'changelog': {
      return `### ${p.projectName} — Weekly Changelog\n\n${top.map(e => `- **${CATEGORY_META[e.category].label}:** ${e.title}`).join('\n')}\n\n*${p.events.length} total changes this week.*`
    }
    case 'threads':
      return `A week ago this didn't exist.\n\nNow ${p.projectName} has:\n${bullets.join('\n')}\n\nBuilding in public, one ship at a time.`
    case 'devto':
      return `## ${p.projectName}: this week's build log\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${counts.commit ?? 0} commits, ${counts.deployment ?? 0} deploys. ${learned ? `Biggest lesson: ${learned}` : ''}`
    case 'producthunt':
      return `${p.projectName} — what shipped this week:\n\n${bullets.join('\n')}\n\nShipping in public. Feedback welcome.`
    case 'resume':
      return top.map(e => `• ${e.title.replace(/^(feat|fix|chore|refactor|perf): /, '').replace(/^./, c => c.toUpperCase())} — ${p.projectName}`).join('\n')
    case 'blog': {
      return `# Building ${p.projectName}: a week in the log\n\n${p.projectTagline}\n\nThis week produced ${p.events.length} logged events. The highlights:\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${learned ? `## What I learned\n\n${learned}\n\n` : ''}## Why I log everything\n\nBy Friday I used to forget what Monday looked like. Now every commit, deploy and customer conversation lands in one timeline — and content like this post writes itself from the raw material.`
    }
  }
}

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
    picked: picked.map(e => ({ category: e.category, title: e.title, date: e.eventDate })),
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

function countBy(events: ShipEvent[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) out[e.category] = (out[e.category] ?? 0) + 1
  return out
}
