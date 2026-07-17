// ── Payments — Paystack, hardwired to the founder's account ──
// PUBLIC key only (pk_live_… / pk_test_…). Shipping it in the bundle is
// safe by design: a public key can only START a payment INTO this account.
// The SECRET key (sk_live_…) can move money OUT — it lives ONLY inside
// n8n's credential vault (payment-confirmer workflow), never in this repo.
//
// Where to find it: dashboard.paystack.com → Settings → API Keys & Webhooks
// → "Public key" (directly above the secret key).
export const PAYSTACK_PUBLIC_KEY = 'pk_live_PASTE_YOUR_PUBLIC_KEY_HERE'

export const paystackReady = () => PAYSTACK_PUBLIC_KEY.startsWith('pk_') && !PAYSTACK_PUBLIC_KEY.includes('PASTE')
