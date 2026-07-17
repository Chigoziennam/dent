# Dent — Go-Live Guide (copy-paste edition)

Everything below is copy-paste ready. Do the blocks in order, top to bottom.
Total time: ~10 minutes to be live on your phone.

---

## 0. What you're deploying

- **App:** Dent (formerly ShipLog) — React + Vite + Tailwind SPA
- **Local source:** `~/Downloads/shiplog`
- **Two deploy targets:**
  - **Vercel** (recommended — live URL in minutes, works on your phone immediately)
  - **Your VPS** `dent.lumenai.sbs` (needs one DNS record — see §5)

---

## 1. One-time: put the repo on GitHub (no file-by-file uploads ever again)

Create an **empty** repo on GitHub first: <https://github.com/new>
Name it `dent`, **don't** add a README/.gitignore (the repo already has them).

Then paste this whole block into Terminal:

```bash
cd ~/Downloads/shiplog
git add -A
git commit -m "Dent rebrand, drag energy tank, live co-pilot briefing, Paystack env key"
git branch -M main
git remote add origin https://github.com/Chigoziennam/dent.git
git push -u origin main
```

> First push asks you to log in — choose "Sign in with your browser".
> From then on, shipping an update is just:
> ```bash
> cd ~/Downloads/shiplog && git add -A && git commit -m "update" && git push
> ```

---

## 2. Deploy on Vercel (the "test on my phone" path)

1. Go to <https://vercel.com/new> → **Import** the `dent` repo (sign in with GitHub).
2. Vercel auto-detects Vite. Don't change build settings — `vercel.json` is already in the repo (SPA rewrites + caching).
3. Before clicking **Deploy**, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://emclkprkvzrbqmwbbwqu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (copy from `~/Downloads/shiplog/.env`) |
| `VITE_N8N_WEBHOOK_BASE` | `https://n8n.lumenai.sbs/webhook` |
| `VITE_PAYSTACK_PUBLIC_KEY` | your `pk_live_...` key (see §4) |

4. Click **Deploy**. You get `https://dent-xxxx.vercel.app` — open it on your phone.
5. Every future `git push` auto-deploys. That's the whole workflow now.

> **iPhone tip:** open the URL in Safari → Share → **Add to Home Screen**.
> The manifest is already set up, so it installs like a real app.

---

## 3. Make the AI co-pilot LIVE (n8n brain)

The app already sends every co-pilot question **and the user's full event log**
to `VITE_N8N_WEBHOOK_BASE + /shiplog-ai`. To switch from the local engine to real Claude:

1. Open <https://n8n.lumenai.sbs> → **Workflows → Import from File**
   → import `n8n-workflows/1-shiplog-ai-writer.json` (already in this repo).
2. In the **Claude API** node, paste your Anthropic API key (server-side — never in the app).
3. **Activate** the workflow (toggle top-right).
4. Done. The co-pilot dot turns green ("live AI"), and the opening briefing,
   chat, writer, humanizer and fusion modes all run on real Claude with the
   user's real event data as context.

Also import + activate while you're there:
- `2-github-event-capture.json` — GitHub pushes become events automatically
- `3-daily-companion-nudge.json` — the daily companion message
- `4-payment-confirmer.json` — verifies Paystack payments with your SECRET key

---

## 4. Paystack — payments land in YOUR account

1. <https://dashboard.paystack.com> → **Settings → API Keys & Webhooks**.
2. Copy the **Public key** (`pk_live_...`).
3. Paste it in two places:
   - Locally: `VITE_PAYSTACK_PUBLIC_KEY=pk_live_...` in `~/Downloads/shiplog/.env`
   - Vercel: same variable in Project → Settings → Environment Variables → redeploy.
4. That's it. Any user who taps **Go Pro / CEO Mode** in naira pays through
   Paystack checkout keyed to YOUR account → settles to your bank on
   Paystack's schedule (Settings → Payouts).

**Never** put the **secret** key (`sk_...`) in `.env` or anywhere in this app —
it belongs only inside the n8n payment-confirmer workflow (server-side).
The public key is safe to ship; it can only *start* payments to you, never move money out.

---

## 5. Fix the VPS site (why dent/shiplog.lumenai.sbs is down)

Diagnosed: **the server is fine — the DNS record was never created.**
`n8n.lumenai.sbs` resolves; `shiplog.lumenai.sbs` doesn't exist in DNS.

1. In your DNS provider (where lumenai.sbs is managed), add:
   ```
   Type: A    Name: dent    Value: 162.35.165.66
   ```
   (or `shiplog` if you want to keep the old subdomain too)
2. Update the Caddyfile on the server to add the `dent.lumenai.sbs` site
   (or ask Claude to do it — it needs the server password).
3. Redeploy the new build any time with:
   ```bash
   cd ~/Downloads/shiplog && ./deploy.sh
   ```

Honestly: use **Vercel as the main deploy** (auto-deploys, global CDN, free)
and keep the VPS copy as a backup/staging mirror.

---

## 6. Rename again later (Dent → Grav or anything)

The brand lives in `src/lib/brand.ts`. For a full sweep of older strings:

```bash
cd ~/Downloads/shiplog
LC_ALL=C find src index.html public/manifest.webmanifest -type f -exec sed -i '' 's/Dent/Grav/g' {} +
npm run build
```

---

## Sanity checklist before you share the link

- [ ] `npm run typecheck` and `npm run build` pass (they did on 2026-07-17)
- [ ] Paystack key set in Vercel env
- [ ] n8n workflow 1 imported + activated → co-pilot dot is green
- [ ] Opened on phone, added to Home Screen
- [ ] Test a ₦ payment with a [Paystack test card](https://paystack.com/docs/payments/test-payments) using your `pk_test_` key first
