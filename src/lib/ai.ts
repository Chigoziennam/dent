import type { ShipEvent, DailyLog, ContentPlatform, Tone } from './types'
import { CATEGORY_META } from './types'

// Works in two modes:
//  1. Demo mode (default): crafted templates fed by real event data — instant, offline.
//  2. Live mode: if VITE_ANTHROPIC_API_KEY is set, calls the Anthropic API.
//     TODO(production): route through a Supabase Edge Function, never ship the key client-side.

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

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
    case 'blog': {
      return `# Building ${p.projectName}: a week in the log\n\n${p.projectTagline}\n\nThis week produced ${p.events.length} logged events. The highlights:\n\n${bullets.map(b => b.replace('→ ', '- ')).join('\n')}\n\n${learned ? `## What I learned\n\n${learned}\n\n` : ''}## Why I log everything\n\nBy Friday I used to forget what Monday looked like. Now every commit, deploy and customer conversation lands in one timeline — and content like this post writes itself from the raw material.`
    }
  }
}

function countBy(events: ShipEvent[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of events) out[e.category] = (out[e.category] ?? 0) + 1
  return out
}
