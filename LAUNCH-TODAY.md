# 🚀 Super Dent X — Beta Launch Runbook

Do these phases IN ORDER. Each one ends with a test so you know it worked
before moving on. Diagnosis is already done — every step here fixes a
confirmed problem, nothing is guesswork.

**Already fixed in code (this commit):** the Vercel build error
(`@supabase/supabase-js` was missing from package.json), Apple removed from
login, the rename to Super Dent X, and the AI now receives full event details.

---

## Phase 1 — Push → Vercel goes green (2 min)

```bash
cd ~/Downloads/shiplog
git push
```

Vercel rebuilds automatically. This time it will succeed — the missing
package is fixed. Watch it at vercel.com → your project → Deployments.

**If you haven't added env vars in Vercel yet** (Project → Settings →
Environment Variables), add these 4, then Redeploy:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://emclkprkvzrbqmwbbwqu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | copy from `~/Downloads/shiplog/.env` |
| `VITE_N8N_WEBHOOK_BASE` | `https://n8n.lumenai.sbs/webhook` |
| `VITE_PAYSTACK_PUBLIC_KEY` | your `pk_live_...` (Phase 5) |

✅ **Test:** open your `https://….vercel.app` URL on your phone. Landing page loads.

---

## Phase 2 — Make login actually work (10 min, all in Supabase dashboard)

I probed your Supabase project (`emclkprkvzrbqmwbbwqu.supabase.co`). It is
**alive and healthy** — login fails because of two dashboard settings:
email confirmation is ON, and GitHub/Google providers are OFF. Fix:

1. **Find the project.** Log in at supabase.com. If you see a project whose
   URL is `emclkprkvzrbqmwbbwqu` — it's yours (created 2025-05-30), use it.
   If you do NOT see it, it belongs to some other account: create a new
   project instead, then in the SQL Editor paste + run the whole file
   `supabase/schema.sql` from this repo, and swap the new URL + anon key
   into `.env` and the Vercel env vars.

2. **Fix email login (the "didn't work at all" bug):**
   Authentication → Sign In / Providers → Email →
   turn **OFF "Confirm email"** → Save.
   Why: with it ON, every signup waits for a confirmation email, and
   Supabase's built-in mailer sends only ~2/hour — that's exactly what you hit.

3. **Enable GitHub login:**
   - github.com → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: your vercel URL
   - Authorization callback URL: `https://emclkprkvzrbqmwbbwqu.supabase.co/auth/v1/callback`
   - Copy Client ID + Secret → Supabase → Authentication → Providers → GitHub → enable, paste, Save.

4. **Enable Google login:**
   - console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID (Web)
   - Authorized redirect URI: `https://emclkprkvzrbqmwbbwqu.supabase.co/auth/v1/callback`
   - Copy Client ID + Secret → Supabase → Providers → Google → enable, paste, Save.
   (If Google feels long, skip it for beta day — email + GitHub is enough to launch.)

5. **Tell Supabase where the app lives:**
   Authentication → URL Configuration →
   - Site URL: `https://your-app.vercel.app`
   - Additional Redirect URLs: `http://localhost:5173`, `https://shiplog.lumenai.sbs`

✅ **Test:** on your phone, Create account with email + password → you should
land straight in `/app/today`, no confirmation email needed.

---

## Phase 3 — Fix the VPS site SSL (1 min)

Diagnosed precisely: your DNS record **is live now** and your deploy **did
reach the server** — but Caddy tried to get the SSL certificate while the
DNS record was still missing, failed, and is waiting in a retry backoff.
Kick it once:

```bash
ssh root@162.35.165.66 'cd /root/lumen-stack && docker compose restart caddy'
```

Wait ~60 seconds, then open https://shiplog.lumenai.sbs — cert gets issued
on the spot. (Or paste the server password in chat and I'll handle the server
side, including adding a nicer `dent.lumenai.sbs` domain.)

Launch order you chose (correct call): **Vercel is the main URL for beta**,
the VPS is your backup/staging.

---

## Phase 4 — Turn the AI brain on (5 min)

1. Open https://n8n.lumenai.sbs → Workflows → **Import from File** →
   `n8n-workflows/1-shiplog-ai-writer.json` (re-import even if you did before —
   I upgraded it today: it now reads event **details** — amounts, payouts,
   blockers, energy — and speaks as Super Dent X).
2. Open the **Claude API** node → put your Anthropic API key in the header.
3. Toggle **Active** (top right).

✅ **Test:** in the app, open the co-pilot bubble → its dot should be green
and the opening briefing should mention your real events *with details*.
This same switch un-generics the **Write** page — it was generic because
the webhook was dead, so you were seeing offline templates.

---

## Phase 5 — Paystack money flow (3 min)

1. dashboard.paystack.com → Settings → API Keys & Webhooks → copy **Public key**.
2. Put it in Vercel env `VITE_PAYSTACK_PUBLIC_KEY` → Redeploy. (And in local `.env`.)
3. Every naira checkout now settles to YOUR Paystack balance → your bank.
4. Test first with your `pk_test_` key + a [test card](https://paystack.com/docs/payments/test-payments), then swap to `pk_live_`.

Never put the `sk_` secret key in the app — it goes only in the n8n
payment-confirmer workflow.

**Log your first payout in the app** under the new **Revenue** category —
the composer opens the details box automatically so the amount gets captured,
and the co-pilot + Write AI will quote it back with the exact figure. 💰

---

## Phase 6 — Beta checklist, then invite people

- [ ] Vercel deployment green, app opens on phone
- [ ] Email signup lands in /app/today with no confirmation step
- [ ] GitHub login round-trips
- [ ] Co-pilot dot green, briefing quotes real events
- [ ] Test payment with pk_test succeeds → swap to pk_live
- [ ] Add to Home Screen on iPhone (Share → Add to Home Screen)
- [ ] Send the link to your first 5 users

Every future update = `git add -A && git commit -m "..." && git push`.
Vercel redeploys itself. No more file uploads, ever.
