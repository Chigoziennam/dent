import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Paste your project values into shiplog/.env (never commit it):
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
// The anon key is designed to be public — Row Level Security is the guard —
// but it still belongs in .env, not in chat logs or screenshots.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null
export const supabaseReady = Boolean(supabase)

// When configured, these mirror the local store to Postgres.
// The app works fully offline; Supabase adds sync + real auth.
export async function syncEvent(userId: string, event: Record<string, unknown>) {
  if (!supabase) return
  await supabase.from('ship_events').insert({ user_id: userId, ...event })
}

export async function signInWithGitHub() {
  if (!supabase) return { error: new Error('Supabase not configured') }
  return supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${location.origin}/app/today` } })
}
