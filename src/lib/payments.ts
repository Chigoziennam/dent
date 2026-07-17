// ── Payments — Paystack, hardwired to the founder's account ──
// PUBLIC key only (pk_live_… / pk_test_…). Shipping it in the bundle is
// safe by design: a public key can only START a payment INTO this account.
// The SECRET key (sk_live_…) can move money OUT — it lives ONLY inside
// n8n's credential vault (payment-confirmer workflow), never in this repo.
//
// Where to find it: dashboard.paystack.com → Settings → API Keys & Webhooks
// → "Public key" (directly above the secret key).
//
// Set it in ONE place — shiplog/.env (and Vercel env for production):
//   VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
// We read that here. The inline fallback stays a harmless placeholder so a
// missing env var can never accidentally point checkout at the wrong account.
const ENV_KEY = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined)?.trim()

export const PAYSTACK_PUBLIC_KEY = ENV_KEY || 'pk_live_PASTE_YOUR_PUBLIC_KEY_HERE'

// Guard rail: a secret key must NEVER drive browser checkout. If one is ever
// pasted into the env by mistake, treat payments as not-ready rather than
// leaking it to every visitor.
export const paystackReady = () =>
  PAYSTACK_PUBLIC_KEY.startsWith('pk_') && !PAYSTACK_PUBLIC_KEY.includes('PASTE')

if (import.meta.env.DEV && PAYSTACK_PUBLIC_KEY.startsWith('sk_')) {
  console.error('[payments] A SECRET key (sk_) is set in VITE_PAYSTACK_PUBLIC_KEY. Remove it — use the pk_ public key only.')
}
