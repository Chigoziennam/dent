import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowLeft, Crown } from 'lucide-react'
import { SpaceBackdrop, Logo } from '../components/ui'
import { useDent } from '../lib/store'
import { track } from '../lib/telemetry'

type Currency = 'NGN' | 'USD'

// Nigeria pays in naira — fair local pricing, not dollar-converted pain
const PRICES: Record<string, Record<Currency, { m: number; y: number }>> = {
  Free: { NGN: { m: 0, y: 0 }, USD: { m: 0, y: 0 } },
  Pro: { NGN: { m: 5000, y: 4200 }, USD: { m: 9, y: 7 } },
  'CEO Mode': { NGN: { m: 10000, y: 8300 }, USD: { m: 19, y: 15 } },
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

// Paystack inline checkout — loads their script once, pays to YOUR account.
// The founder's PUBLIC key ships with the build via env; every user's payment
// settles straight to the founder's Paystack balance → bank account.
// (Public keys are safe client-side. The SECRET key never leaves the server —
// the n8n payment-confirmer verifies transactions with it.)
const FOUNDER_PAYSTACK_KEY = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined)?.trim() || undefined
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

const TIERS = [
  {
    name: 'Free',
    price: { m: 0, y: 0 },
    tag: 'For the first ship',
    features: [
      '30 events / month',
      '1 integration (GitHub)',
      '2 AI generations / week',
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
      'Unlimited events & integrations',
      'Unlimited AI generations',
      'Raw notes → Human post writer',
      'Weekly digest emails',
      'Advanced analytics',
      'Custom domain for your profile',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
  {
    name: 'CEO Mode',
    price: { m: 19, y: 15 },
    tag: 'For the builder becoming a founder',
    features: [
      'Everything in Pro',
      'Resume Builder — ships become bullet points',
      'Product Hunt launch kit',
      'Team dashboard & shared changelog',
      'API access',
      'Priority support',
    ],
    cta: 'Run the company',
    highlight: false,
    crown: true,
  },
]

export default function Pricing() {
  const [yearly, setYearly] = useState(false)
  const [currency, setCurrency] = useState<Currency>(detectCurrency())
  const [payMsg, setPayMsg] = useState<string | null>(null)
  const { creds, updateProfile } = useDent()

  useEffect(() => { track('plan_viewed', { currency }) }, [currency])

  // Real checkout when the founder's Paystack key is set and we're in NGN
  const checkout = async (tierName: string) => {
    const amount = PRICES[tierName]?.[currency][yearly ? 'y' : 'm'] ?? 0
    if (amount === 0) return
    // creds key (Settings) overrides for testing; env key is the production default
    const payKey = creds.paystackPublicKey || FOUNDER_PAYSTACK_KEY
    if (currency !== 'NGN' || !payKey) {
      setPayMsg('Card payments go live at launch — Nigerian builders pay in naira via Paystack.')
      setTimeout(() => setPayMsg(null), 3000)
      return
    }
    const email = window.prompt('Email for your receipt:')
    if (!email?.includes('@')) return
    await loadPaystack()
    const Pop = (window as unknown as { PaystackPop: new () => { newTransaction: (o: Record<string, unknown>) => void } }).PaystackPop
    new Pop().newTransaction({
      key: payKey,
      email,
      amount: amount * 100, // kobo
      currency: 'NGN',
      metadata: { tier: tierName, cycle: yearly ? 'yearly' : 'monthly' },
      onSuccess: () => {
        updateProfile({ tier: tierName === 'CEO Mode' ? 'team' : 'pro' })
        setPayMsg('Payment received — welcome aboard! Your plan is active. 🎉')
        setTimeout(() => setPayMsg(null), 4000)
      },
      onCancel: () => {},
    })
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-base">
      <div className="pointer-events-none fixed inset-0"><SpaceBackdrop /></div>
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={30} /><span className="font-bold tracking-tight">Dent</span>
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
          <br /><span className="text-gradient">CEOs ship louder.</span>
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
                {t.crown && <Crown size={15} className="text-warning" />}
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
                    onClick={() => checkout(t.name)}
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold ${t.highlight ? 'sheen bg-accent text-white shadow-[0_0_28px_rgba(99,102,241,0.4)]' : 'border border-line text-secondary transition-colors hover:border-line-hover hover:text-primary'}`}
                  >
                    {t.cta}{currency === 'NGN' && (creds.paystackPublicKey || FOUNDER_PAYSTACK_KEY) ? ' · pay with Paystack' : ''}
                  </button>
                )}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-10 text-center text-xs text-muted">
          Launch pricing — locked in forever for early builders. Every feature is unlocked for everyone during the beta.
          {currency === 'NGN' && <span className="mt-1 block">Payments in naira via Paystack — no dollar cards needed.</span>}
        </p>

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
