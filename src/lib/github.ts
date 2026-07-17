// ── GitHub — a REAL integration, not a green checkmark ──
// Given a username (and an optional token to raise the rate limit / see
// private activity when you're the authenticated user), this pulls your
// actual recent commits and releases straight from the GitHub REST API in
// the browser and turns them into ship events. Every event gets a stable id
// (gh_<sha>) so re-syncing is idempotent — no duplicates, ever.
import type { ShipEvent, EventCategory } from './types'

const API = 'https://api.github.com'

export interface GithubConn { user: string; token?: string }

export interface GithubAccount {
  login: string
  name: string | null
  avatar_url: string
  public_repos: number
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function friendlyError(status: number): string {
  if (status === 401) return 'That token was rejected — check it and try again.'
  if (status === 403) return 'GitHub rate limit hit. Add a personal access token to raise it.'
  if (status === 404) return "Couldn't find that GitHub username."
  return `GitHub returned ${status}. Try again in a moment.`
}

// Prove the connection is real before we ever show "Connected".
export async function verifyGithub({ user, token }: GithubConn): Promise<GithubAccount> {
  const res = await fetch(`${API}/users/${encodeURIComponent(user)}`, { headers: headers(token) })
  if (!res.ok) throw new Error(res.status === 404 ? `No GitHub user "${user}"` : friendlyError(res.status))
  return res.json()
}

// Map a commit's first line to the log's language.
function categorize(msg: string): EventCategory {
  const m = msg.toLowerCase()
  if (/\b(deploy|deployed|deployment|release|released|ship(ped)?\s+to\s+prod)\b/.test(m)) return 'deployment'
  if (/^feat(\(|:|\b)|^add\b|\bfeature\b|\bimplement\b/.test(m)) return 'feature'
  if (/^fix(\(|:|\b)|\bbug\b|\bhotfix\b|\bpatch\b/.test(m)) return 'bugfix'
  if (/^design|\bui\b|\bstyle\b|\bcss\b/.test(m)) return 'design'
  return 'commit'
}

// Pull recent commits + releases as ship events (newest first, deduped).
export async function fetchGithubShips(conn: GithubConn, sinceDays = 30): Promise<ShipEvent[]> {
  const { user, token } = conn
  // With a token, authenticated-as-you includes private activity; without, the
  // same endpoint returns public events. One call, works both ways.
  const res = await fetch(`${API}/users/${encodeURIComponent(user)}/events?per_page=100`, { headers: headers(token) })
  if (!res.ok) throw new Error(friendlyError(res.status))
  const raw = (await res.json()) as GithubEvent[]
  const cutoff = Date.now() - sinceDays * 864e5
  const out: ShipEvent[] = []

  for (const ev of raw) {
    const when = new Date(ev.created_at).getTime()
    if (when < cutoff) continue
    const repo = (ev.repo?.name ?? '').split('/').pop() ?? 'repo'

    if (ev.type === 'PushEvent' && ev.payload?.commits) {
      for (const c of ev.payload.commits) {
        const msg = (c.message ?? '').split('\n')[0].trim()
        // Skip auto-merge noise — it's not a story worth posting about.
        if (!msg || /^merge (branch|pull request|remote)/i.test(msg)) continue
        out.push({
          id: `gh_${c.sha}`,
          source: 'github',
          category: categorize(msg),
          title: msg.slice(0, 140),
          description: `\`${c.sha.slice(0, 7)}\` · ${repo}`,
          importance: 5,
          isPinned: false,
          eventDate: ev.created_at.slice(0, 10),
          eventTime: ev.created_at,
        })
      }
    } else if (ev.type === 'ReleaseEvent' && ev.payload?.release) {
      const rel = ev.payload.release
      out.push({
        id: `gh_rel_${rel.id}`,
        source: 'github',
        category: 'deployment',
        title: `Released ${rel.tag_name ?? rel.name ?? ''} · ${repo}`.trim(),
        description: (rel.body ?? '').slice(0, 240).trim() || undefined,
        importance: 8,
        isPinned: false,
        eventDate: ev.created_at.slice(0, 10),
        eventTime: ev.created_at,
      })
    }
  }

  const seen = new Set<string>()
  return out
    .filter(e => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => b.eventTime.localeCompare(a.eventTime))
}

// Minimal shapes for the slice of the GitHub events API we touch.
interface GithubEvent {
  type: string
  created_at: string
  repo?: { name: string }
  payload?: {
    commits?: { sha: string; message: string }[]
    release?: { id: number; tag_name?: string; name?: string; body?: string }
  }
}
