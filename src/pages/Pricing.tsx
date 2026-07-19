import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowLeft, X, ShieldCheck } from 'lucide-react'
import { SpaceBackdrop, Logo } from '../components/ui'
import { useDent } from '../lib/store'
import { track } from '../lib/telemetry'
import { PAYSTACK_PUBLIC_KEY, paystackReady } from '../lib/payments'
import { recordPayment } from '../lib/sync'

type Currency = 'NGN' | 'USD'

// Nigeria pays in naira — fair local pricing, not dollar-converted pain
const PRICES: Record<string, Record<Currency, { m: number; y: number }>> = {
  Free: { NGN: { m: 0, y: 0 }, USD: { m: 0, y: 0 } },
  Pro: { NGN: { m: 7500, y: 6250 }, USD: { m: 9, y: 7 } },
}
const SYMBOL: Record<Currency, string> = { NGN: '₦', USD: '$' }

function detectCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Africa/Lagos') return 'NGN'
    if (navigator.language.toLowerCase().includes('-ng')) return 'NGN'
  } catch { /* default USD */ }
  return 'USD'
}

// Paystack inline checkout — loads their script once, pays to the founder's
// account. The public key is hardwired in src/lib/payments.ts (no env vars);
// the SECRET key never touches the app — it lives only in n8n.
let paystackLoading: Promise<void> | null = null
function loadPaystack(): Promise<void> {
  if (paystackLoading) return paystackLoading
  paystackLoading = new Promise(resolve => {
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v2/inline.js'
    s.onload = () => resolve()
    document.body.appendChild(s)
  })
  return paystackLoading
}

// One free tier, one paid tier. CEO Mode is gone: it split working features
// across two prices and advertised four that were never built (custom domain,
// API access, team dashboard, priority support). Everything listed below is
// shipped and testable today — if it is not in the app, it is not on this page.
// Limits mirror ENTITLEMENTS in src/lib/plan.ts and are enforced server-side
// in the n8n prompt node, so they are stated honestly rather than as "unlimited".
const TIERS = [
  {
    name: 'Free',
    price: { m: 0, y: 0 },
    tag: 'For the first ship',
    features: [
      '5 AI posts / week',
      '8 co-pilot messages / day',
      '30 events / month',
      'GitHub sync',
      'Public profile & changelog',
      'Streaks & achievements',
    ],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: { m: 9, y: 7 },
    tag: 'For the daily shipper',
    features: [
      '100 AI posts / month',
      '30 co-pilot messages / day',
      'Unlimited events & GitHub sync',
      'Raw notes → Human post writer',
      'Fusion mode — your words, sharpened',
      'Resume & Product Hunt outputs',
      'Analytics and scoped exports',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
]

// Paystack on this account charges NAIRA only. Dollar buyers still pay the
// full $ price — we bill its naira equivalent at this rate, and their bank
// converts. Update the rate in .env (VITE_USD_NGN_RATE) as the market moves.
const USD_NGN_RATE = Number(import.meta.env.VITE_USD_NGN_RATE) || 1600

// The exact charge for a tier. Yearly bills 12× the per-month rate, once.
// billNgn is what Paystack actually charges: local ₦ price for naira buyers,
// $-price × rate for dollar buyers (international pricing, settled in ₦).
function quote(tierName: string, currency: Currency, yearly: boolean) {
  const perMonthNgn = PRICES[tierName]?.NGN[yearly ? 'y' : 'm'] ?? 0
  const perMonthUsd = PRICES[tierName]?.USD[yearly ? 'y' : 'm'] ?? 0
  const chargeNgn = yearly ? perMonthNgn * 12 : perMonthNgn
  const chargeUsd = yearly ? perMonthUsd * 12 : perMonthUsd
  return {
    tier: tierName,
    cycle: (yearly ? 'yearly' : 'monthly') as 'yearly' | 'monthly',
    perMonthNgn, perMonthUsd,
    chargeNgn, chargeUsd,
    billNgn: currency === 'NGN' ? chargeNgn : chargeUsd * USD_NGN_RATE,
    currency,
  }
}
type Quote = ReturnType<typeof quote>

export default function Pricing() {
  const [yearly, setYearly] = useState(false)
  const [currency, setCurrency] = useState<Currency>(detectCurrency())
  const [payMsg, setPayMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Quote | null>(null)
  const [email, setEmail] = useState('')
  const [emailErr, setEmailErr] = useState(false)
  const [paying, setPaying] = useState(false)
  const { updateProfile } = useDent()

  useEffect(() => { track('plan_viewed', { currency }) }, [currency])

  // Step 1 — open the confirmation with the EXACT amount, before any charge.
  const openConfirm = (tierName: string) => {
    const q = quote(tierName, currency, yearly)
    if (q.chargeNgn === 0) return
    if (!paystackReady()) {
      setPayMsg('Payments are being set up — please check back shortly.')
      setTimeout(() => setPayMsg(null), 3000)
      return
    }
    setEmail(''); setEmailErr(false)
    setConfirm(q)
  }

  // Step 2 — only after the user confirms the exact amount do we charge.
  // Every charge goes through in naira (the account's settlement currency);
  // dollar buyers pay the $ price converted at USD_NGN_RATE — any Visa or
  // Mastercard worldwide can pay a naira charge, the bank does the FX.
  const pay = async () => {
    if (!confirm) return
    if (!email.includes('@')) { setEmailErr(true); return }
    setPaying(true)
    await loadPaystack()
    const Pop = (window as unknown as { PaystackPop: new () => { newTransaction: (o: Record<string, unknown>) => void } }).PaystackPop
    const amountMinor = Math.round(confirm.billNgn * 100) // kobo
    new Pop().newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: amountMinor,
      currency: 'NGN',
      metadata: { tier: confirm.tier, cycle: confirm.cycle, priced_in: confirm.currency },
      onSuccess: (tx: { reference?: string }) => {
        // Activate EXACTLY the plan they paid for, and sync the tier to cloud.
        // One paid plan now, so every successful checkout lands on 'pro'.
        // The expiry is what makes it a subscription rather than a one-time
        // unlock — without it a single ₦5,000 bought Pro forever. Renewals
        // extend from the later of now and the current expiry, so paying
        // early adds time instead of throwing the remainder away.
        const now = new Date()
        const current = /* existing expiry, if the plan is still running */
          (useDent.getState().profile.planExpiresAt
            && new Date(useDent.getState().profile.planExpiresAt as string) > now)
            ? new Date(useDent.getState().profile.planExpiresAt as string)
            : now
        const expires = new Date(current)
        if (confirm.cycle === 'yearly') expires.setFullYear(expires.getFullYear() + 1)
        else expires.setMonth(expires.getMonth() + 1)
        updateProfile({
          tier: 'pro',
          planStartedAt: now.toISOString(),
          planExpiresAt: expires.toISOString(),
          planCycle: confirm.cycle,
        })
        recordPayment({ email, amountMinor, currency: 'NGN', tier: confirm.tier, cycle: confirm.cycle, reference: tx?.reference })
        track('payment_success', { tier: confirm.tier, cycle: confirm.cycle, currency: confirm.currency })
        setPaying(false)
        setConfirm(null)
        setPayMsg(`Payment confirmed — ${confirm.tier} is now active. 🎉`)
        setTimeout(() => setPayMsg(null), 4000)
      },
      onCancel: () => { setPaying(false) },
      onError: () => {
        setPaying(false)
        setPayMsg('Payment failed — nothing was charged. Please try again.')
        setTimeout(() => setPayMsg(null), 6000)
      },
    })
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-base">
      <div className="pointer-events-none fixed inset-0"><SpaceBackdrop /></div>
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={30} /><span className="font-bold tracking-tight">Super Dent X</span>
        </Link>
        <Link to="/login" className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-medium text-secondary hover:border-line-hover hover:text-primary">
          Sign in
        </Link>
      </nav>

      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"><ArrowLeft size={12} /> Back</Link>
        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center text-4xl font-bold tracking-tight md:text-5xl"
        >
          Every builder ships free.
          <br /><span className="text-gradient">Daily shippers go Pro.</span>
        </motion.h1>
        <p className="mx-auto mt-4 max-w-md text-center text-secondary">
          Start free forever. Upgrade when your audience — or your ambition — outgrows the plan.
        </p>

        {/* Currency */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {(['NGN', 'USD'] as Currency[]).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${currency === c ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-secondary'}`}
            >
              {c === 'NGN' ? '🇳🇬 Naira' : '$ USD'}
            </button>
          ))}
        </div>

        {/* Toggle */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className={`text-sm ${!yearly ? 'font-semibold text-primary' : 'text-muted'}`}>Monthly</span>
          <button
            onClick={() => setYearly(y => !y)}
            className="relative h-7 w-12 rounded-full border border-line bg-white/5"
            aria-label="Toggle yearly pricing"
          >
            <motion.div
              className="absolute top-0.5 h-5.5 w-5.5 rounded-full bg-accent shadow-[0_0_12px_rgba(99,102,241,0.5)]"
              animate={{ left: yearly ? 24 : 3 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              style={{ height: 22, width: 22 }}
            />
          </button>
          <span className={`text-sm ${yearly ? 'font-semibold text-primary' : 'text-muted'}`}>
            Yearly <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">2 months free</span>
          </span>
        </div>

        <motion.div
          initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="mt-10 grid gap-5 md:grid-cols-3"
        >
          {TIERS.map(t => (
            <motion.div
              key={t.name}
              variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }}
              whileHover={{ y: -4 }}
              className={`glass relative flex flex-col p-6 ${t.highlight ? '!border-accent/50 shadow-[0_0_48px_rgba(99,102,241,0.2)]' : ''}`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{t.name}</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted">{t.tag}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-4xl font-bold">
                  {SYMBOL[currency]}{(PRICES[t.name]?.[currency][yearly ? 'y' : 'm'] ?? 0).toLocaleString()}
                </span>
                <span className="text-sm text-muted">/mo{yearly && (PRICES[t.name]?.[currency].m ?? 0) > 0 ? ' · billed yearly' : ''}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-secondary">
                    <Check size={14} className="mt-0.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <motion.div whileTap={{ scale: 0.97 }} className="mt-6">
                {t.name === 'Free' ? (
                  <Link
                    to="/login"
                    className="block rounded-xl border border-line py-3 text-center text-sm font-semibold text-secondary transition-colors hover:border-line-hover hover:text-primary"
                  >
                    {t.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConfirm(t.name)}
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold ${t.highlight ? 'sheen bg-accent text-white shadow-[0_0_28px_rgba(99,102,241,0.4)]' : 'border border-line text-secondary transition-colors hover:border-line-hover hover:text-primary'}`}
                  >
                    {t.cta}{paystackReady() ? ' · pay with Paystack' : ''}
                  </button>
                )}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Say what actually happens. The old copy promised "every feature
            unlocked for everyone during the beta", which stopped being true
            the moment limits were enforced — and limits users discover by
            hitting them are how you lose trust and get chargebacks. */}
        <p className="mt-10 text-center text-xs text-muted">
          Launch pricing — locked in forever for early builders. Limits reset automatically:
          co-pilot messages daily, AI posts weekly and monthly.
          {currency === 'NGN' ? (
            <span className="mt-1 block">Payments in naira via Paystack — no dollar cards needed.</span>
          ) : (
            <span className="mt-1 block">
              Paying from the US, UK, EU or anywhere outside Nigeria? Any Visa, Mastercard or Amex works.
              You are charged the naira equivalent of ${PRICES.Pro.USD.m}/mo through Paystack and your bank
              converts automatically — the dollar amount above is what lands on your statement.
              Some US banks add a foreign-transaction fee of 1-3%.
            </span>
          )}
        </p>

        {/* Confirm the EXACT amount (₦ and $) before anything is charged */}
        <AnimatePresence>
          {confirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
              onClick={() => !paying && setConfirm(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="glass-strong w-full max-w-sm rounded-t-3xl p-6 md:rounded-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold tracking-tight">Confirm your plan</h3>
                  <button onClick={() => !paying && setConfirm(null)} className="rounded-lg p-1.5 text-muted hover:bg-white/5"><X size={16} /></button>
                </div>

                <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{confirm.tier}</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">{confirm.cycle}</span>
                  </div>
                  {/* Exact charged amount, in the currency the user chose */}
                  <div className="mt-3 flex items-baseline gap-2">
                    {confirm.currency === 'NGN' ? (
                      <>
                        <span className="font-mono text-3xl font-bold text-primary">₦{confirm.chargeNgn.toLocaleString()}</span>
                        <span className="text-sm text-secondary">≈ ${confirm.chargeUsd.toLocaleString()}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-3xl font-bold text-primary">${confirm.chargeUsd.toLocaleString()}</span>
                        <span className="text-sm text-secondary">billed as ₦{confirm.billNgn.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {confirm.currency === 'NGN'
                      ? (confirm.cycle === 'yearly'
                          ? `Billed once for the year — ₦${confirm.perMonthNgn.toLocaleString()}/mo × 12.`
                          : `Billed monthly — ₦${confirm.perMonthNgn.toLocaleString()} each month.`)
                      : (confirm.cycle === 'yearly'
                          ? `Billed once for the year — $${confirm.perMonthUsd.toLocaleString()}/mo × 12, charged in naira; your card converts automatically.`
                          : `Billed monthly — $${confirm.perMonthUsd.toLocaleString()} each month, charged in naira; your card converts automatically.`)}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-medium text-secondary">Email for your receipt & account</span>
                  <input
                    type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(false) }}
                    placeholder="you@buildsthings.com"
                    className={`w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-sm placeholder:text-muted ${emailErr ? 'border-red-400/60' : 'border-line'}`}
                  />
                  {emailErr && <span className="mt-1 block text-[11px] text-red-400">Enter a valid email so we can activate your plan.</span>}
                </label>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={pay}
                  disabled={paying}
                  className="sheen mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.4)] disabled:opacity-60"
                >
                  {paying ? 'Opening secure checkout…' : `Confirm & pay ${confirm.currency === 'NGN' ? `₦${confirm.chargeNgn.toLocaleString()}` : `$${confirm.chargeUsd.toLocaleString()} (₦${confirm.billNgn.toLocaleString()})`}`}
                </motion.button>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] text-muted">
                  <ShieldCheck size={12} className="text-success" /> Secure checkout by Paystack · charged in naira (₦) · international cards welcome
                </div>
                <p className="mt-1 text-center text-[10.5px] text-muted">Your plan activates only after payment succeeds.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {payMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-strong fixed bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-4 py-2.5 text-[13px] text-primary"
          >
            {payMsg}
          </motion.div>
        )}
      </div>
    </div>
  )
}
