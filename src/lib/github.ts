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

export interface GithubRepo { name: string; full_name: string; pushed_at: string; private: boolean }

// The user's most recently pushed repos — feeds the sync AND the repo picker.
// With a token we use /user/repos so private repos are included too.
export async function fetchGithubRepos(conn: GithubConn, limit = 6): Promise<GithubRepo[]> {
  const { user, token } = conn
  const url = token
    ? `${API}/user/repos?sort=pushed&per_page=${limit}&affiliation=owner`
    : `${API}/users/${encodeURIComponent(user)}/repos?sort=pushed&per_page=${limit}`
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) throw new Error(friendlyError(res.status))
  return res.json()
}

// Pull recent commits + releases as ship events (newest first, deduped).
// NOTE: we deliberately do NOT use the /users/:u/events feed — GitHub's public
// events API stopped including commit details in PushEvent payloads, so a sync
// built on it "succeeds" while importing nothing. The repo commits API always
// returns full messages, so we walk the recently-pushed repos instead.
export async function fetchGithubShips(conn: GithubConn, sinceDays = 30): Promise<ShipEvent[]> {
  const { user, token } = conn
  const cutoffMs = Date.now() - sinceDays * 864e5
  const since = new Date(cutoffMs).toISOString()
  const repos = (await fetchGithubRepos(conn, 6)).filter(r => new Date(r.pushed_at).getTime() >= cutoffMs)
  const out: ShipEvent[] = []

  await Promise.all(repos.map(async r => {
    const repo = r.name
    // Commits authored by the user in this repo since the cutoff. If the
    // author filter finds nothing (common when local git email isn't linked
    // to the GitHub account), fall back to ALL commits in the window — these
    // are the user's own repos, so for a solo builder they're their commits.
    let commits: GithubCommit[] = []
    const cRes = await fetch(
      `${API}/repos/${r.full_name}/commits?author=${encodeURIComponent(user)}&since=${since}&per_page=60`,
      { headers: headers(token) },
    )
    if (cRes.ok) commits = (await cRes.json()) as GithubCommit[]
    if (commits.length === 0) {
      const allRes = await fetch(`${API}/repos/${r.full_name}/commits?since=${since}&per_page=60`, { headers: headers(token) })
      if (allRes.ok) commits = (await allRes.json()) as GithubCommit[]
    }
    {
      for (const c of commits) {
        const msg = (c.commit?.message ?? '').split('\n')[0].trim()
        // Skip auto-merge noise — it's not a story worth posting about.
        if (!msg || /^merge (branch|pull request|remote)/i.test(msg)) continue
        const when = c.commit?.author?.date ?? c.commit?.committer?.date
        if (!when || new Date(when).getTime() < cutoffMs) continue
        out.push({
          id: `gh_${c.sha}`,
          source: 'github',
          category: categorize(msg),
          title: msg.slice(0, 140),
          description: `\`${c.sha.slice(0, 7)}\` · ${repo}`,
          importance: 5,
          isPinned: false,
          eventDate: when.slice(0, 10),
          eventTime: when,
          repo,
        })
      }
    }
    // Releases in the window → deployment events
    const relRes = await fetch(`${API}/repos/${r.full_name}/releases?per_page=5`, { headers: headers(token) })
    if (relRes.ok) {
      const rels = (await relRes.json()) as GithubRelease[]
      for (const rel of rels) {
        const when = rel.published_at ?? rel.created_at
        if (!when || new Date(when).getTime() < cutoffMs) continue
        out.push({
          id: `gh_rel_${rel.id}`,
          source: 'github',
          category: 'deployment',
          title: `Released ${rel.tag_name ?? rel.name ?? ''} · ${repo}`.trim(),
          description: (rel.body ?? '').slice(0, 240).trim() || undefined,
          importance: 8,
          isPinned: false,
          eventDate: when.slice(0, 10),
          eventTime: when,
          repo,
        })
      }
    }
  }))

  const seen = new Set<string>()
  return out
    .filter(e => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => b.eventTime.localeCompare(a.eventTime))
}

// Which repo a ship belongs to. Newer synced events carry e.repo; older ones
// only have it embedded in the description ("`abc1234` · repo-name").
export function repoOf(e: ShipEvent): string | null {
  if (e.repo) return e.repo
  if (e.source !== 'github') return null
  const m = e.description?.match(/`[0-9a-f]{7}` · (\S+)/)
  return m ? m[1] : null
}

// Minimal shapes for the slices of the GitHub API we touch.
interface GithubCommit {
  sha: string
  commit?: { message?: string; author?: { date?: string }; committer?: { date?: string } }
}
interface GithubRelease {
  id: number
  tag_name?: string
  name?: string
  body?: string
  published_at?: string
  created_at?: string
}
