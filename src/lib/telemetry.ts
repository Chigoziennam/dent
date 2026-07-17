// ── Founder telemetry ─────────────────────────────────────────
// Fire-and-forget signals to YOUR Supabase (the Super Dent X owner's),
// so you can watch first users: signups, ships, AI usage, upgrades.
// Users' own Supabase creds (Integrations page) are separate — that
// syncs THEIR log to THEIR database. This is product analytics only:
// event names + counts, never log contents or credentials.

const OWNER_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const OWNER_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

type TelemetryEvent =
  | 'session_start' | 'demo_login' | 'signup'
  | 'real_login_fresh' | 'onboarded' | 'payment_success'
  | 'ship_logged' | 'daily_log_saved' | 'ai_generated'
  | 'pdf_exported' | 'plan_viewed' | 'credits_viewed'
  | 'events_imported'

export function track(event: TelemetryEvent, props: Record<string, string | number | boolean> = {}) {
  if (!OWNER_URL || !OWNER_ANON) return
  // sendBeacon-style: never block or break the app
  fetch(`${OWNER_URL}/rest/v1/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: OWNER_ANON,
      Authorization: `Bearer ${OWNER_ANON}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event,
      props,
      device: deviceId(),
      ua: navigator.userAgent.slice(0, 120),
    }),
    keepalive: true,
  }).catch(() => { /* analytics must never crash the product */ })
}

// Anonymous, stable per-browser id — lets you count uniques without accounts
function deviceId(): string {
  const KEY = 'shiplog-device'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
