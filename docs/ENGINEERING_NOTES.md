# Ikàton — app

Next.js 15 (App Router) · TypeScript · Tailwind 4 · Motion · GSAP · Lenis · Prisma · Supabase (Auth + Postgres).

```bash
cp .env.example .env.local   # add Supabase keys and local secrets
# Put DATABASE_URL and DIRECT_URL in .env; Prisma CLI does not read .env.local
npm install
npm run db:push              # applies the schema and database constraints
npm run dev
npm test                     # signature + state machine tests
```

## Portfolio mode

- **Desktop (≥1024px)**: project page on the left, the live app inside a phone frame on the right (same-origin iframe, so sheets and scroll behave like on a phone). The address bar follows the app. Text lives in `src/config/showcase.ts`; put your name and links there.
- **Phone**: the app full-screen. Installable (manifest + service worker). The API is never cached: an offline app shows "Pas de réseau", never a stale balance.
- **One-tap demo** (`DEMO_MODE=true`): anonymous Supabase session; the two demo circles are created on first use (member in one, admin in the other with cash to validate). Enable *Anonymous sign-ins* in Supabase → Auth → Providers.
- **Demo operator** (`/pay/sandbox`): the visitor plays Wave and picks *valider, refuser, ne rien faire, confirmer deux fois, fausse confirmation*. Each choice sends real signed (or forged) webhooks through the same pipeline as Wave, and the page shows what the server answered. Timeout is 2 min in demo mode.
- Clean up old anonymous users periodically (Supabase dashboard or a cron).

## Structure

```
src/app
  onboarding/            3 slides, collage masks
  auth/                  phone → SMS OTP (Supabase)
  (app)/home             circles, what's due
  (app)/tontines/[id]    pot gauge, members, pay sheet, cash validation (admin of THIS circle only)
  (app)/tontines/[id]/order   sealed order, GSAP reveal
  (app)/profile          theme toggle
  pay/return             landing after Wave / Orange — shows only server-verified status
  api/payments           POST initiate (Idempotency-Key) · GET resume
  api/payments/[id]      GET status · POST "vérifier" · DELETE cancel
  api/webhooks/wave      HMAC signature check
  api/webhooks/orange    notif_token check
  api/cron/expire-payments
  api/cash/[paymentId]   admin confirms / refuses cash
src/lib/payments
  status.ts      state machine
  verify.ts      signature / token verification (timing-safe)
  initiate.ts    idempotent creation, one live attempt per share
  settle.ts      confirm exactly once (serializable tx)
  reconcile.ts   ask the provider, expire stale payments
  providers/     wave.ts, orange.ts
```

## Payment safety

**1. The confirmation never arrives.**
Each payment gets `expiresAt` (`PAYMENT_TIMEOUT_MINUTES`, default 15; cash: due date + 3 days).
`/api/cron/expire-payments` runs every 5 min: it asks the provider one last time, then marks the payment `EXPIRED`.
Status reads also expire on the spot (`freshen`), so the UI never shows "en attente" after the deadline, even if the cron is late.
If the money really did move after expiry, a verified late confirmation can still move `EXPIRED → CONFIRMED`, or to `NEEDS_REVIEW` (refund) if the share was paid in the meantime.

**2. The confirmation arrives twice.**
Four layers:
- `WebhookEvent (provider, eventId)` unique: a redelivered event is answered with 200 and does nothing.
- Compare-and-set on status (`updateMany where status = current`): only one writer wins.
- `Contribution (membershipId, cycleId)` unique: a share can be counted only once, whatever the payment.
- `Contribution.paymentId` unique, plus a serializable transaction with retry.
On the client side, `Idempotency-Key` + a partial unique index (one `INITIATED|PENDING` attempt per share) mean a double tap never charges twice.

**3. Someone sends a fake confirmation.**
- Wave: HMAC-SHA256 of `timestamp + raw body`, compared in constant time, rejected if older than 5 min (replay).
- Orange: the `notif_token` returned at init is stored hashed and compared in constant time.
- Even a valid webhook only **triggers** a check. Amount and status always come from a server-to-server call to the provider (`fetchStatus`). Amount or currency mismatch → `NEEDS_REVIEW`, never counted.
- Forged attempts are stored with `signatureOk = false` for audit.
- The `/pay/return` redirect proves nothing. It only displays what the server verified.

⚠ Provider field names follow Wave Checkout API and Orange WebPay v1 as documented. Check them against your merchant contracts before going live.

## What this changes in the UI

- **Pot gauge** counts only confirmed shares. In-progress payments are hatched and labelled "en vérification, pas encore comptée".
- **Member status** has a 5th state, *En vérification* (dashed rotating ring), separate from *Payé*.
- **Payment panel** has one view per state: waiting with a live countdown + "J'ai validé, vérifier" + "Annuler"; final check once the countdown ends; confirmed; refused ("rien n'a été débité" + Réessayer); expired (explains automatic refund/count); to be settled (amount mismatch / share already paid → refund).
- Reopening the sheet **resumes** the live attempt instead of starting a new one.
- Errors are phrased so the member knows nothing was charged twice.

## Not wired yet

Create circle (`/tontines/new`), join by code (`/join`), ledger, payout, leave, reminders, and Moov / card providers. The design files (`Ikaton.dc.html`, `Ikaton Dark.dc.html`) are the reference for these screens.
On Vercel Hobby, crons run once a day. Use Pro, or Supabase `pg_cron` calling the endpoint.
