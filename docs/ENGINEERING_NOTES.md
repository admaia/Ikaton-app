# Engineering notes

How Ikàton is put together, and why the payment code looks the way it does.

## What runs where

- **Phone:** the app, full screen. It can be installed (manifest and service worker). Requests to the API are never cached, so an offline phone shows "No network", never an old balance.
- **Computer (1024px and wider):** the project page on the left and the live app inside a phone frame on the right. The frame is a same-origin iframe, so sheets and scrolling behave like on a phone. The text of that page lives in `src/config/showcase.ts`.
- **Languages:** English by default, French with one tap. The choice is stored in a cookie and read on the server. Ledger lines are stored in French as they were written and translated when displayed.

## The demo

With `DEMO_MODE=true`, the first tap creates an anonymous Supabase session and four circles for that visitor: member in two, organiser of two. One circle has a share to pay, one has cash deposits to validate, one already paid the visitor their pot, and one is still filling up.

When the visitor pays, they play the mobile money operator inside the pay sheet. Each choice calls `POST /api/sandbox/[paymentId]`, which sends real signed webhooks, or forged ones, to the same handler code a real provider would reach. The sheet then shows what the server answered. A demo payment expires after 2 minutes.

The app refuses to start in demo mode with a missing, short or default sandbox secret, because anyone could then forge confirmations on a public site.

## Structure

```
src/app
  onboarding/                 intro slides, then the demo button
  auth/                       phone number and SMS code (Supabase)
  (app)/home                  what is due, the current circle, last ledger lines
  (app)/tontines              every circle the member belongs to
  (app)/tontines/[id]         pot, members, order of turns, pay sheet, cash to validate
  (app)/tontines/[id]/registre   the full ledger, by cycle
  (app)/tontines/[id]/tour       the member's own payout
  (app)/tontines/[id]/order      the sealed order of turns
  (app)/profile               language, theme, restart the demo
  pay/return                  landing page after a provider checkout
  api/payments                POST start a payment, GET the latest one for a cycle
  api/payments/[id]           GET status, POST check with the provider, DELETE cancel
  api/cash/[paymentId]        the organiser confirms or refuses a cash deposit
  api/webhooks/wave           HMAC signature check
  api/webhooks/orange         notification token check
  api/webhooks/sandbox        same signature check, demo only
  api/sandbox/[paymentId]     the demo operator
  api/cron/expire-payments    closes payments that ran out of time
  api/demo                    creates the demo circles
src/lib/payments
  status.ts      the allowed status changes
  verify.ts      signature and token checks, compared in constant time
  initiate.ts    starts a payment, one live attempt per share
  settle.ts      counts a share exactly once
  reconcile.ts   asks the provider, expires stale payments
  providers/     wave.ts, orange.ts, sandbox.ts
```

## Payment safety

**1. The confirmation never arrives.**
Each payment gets an `expiresAt`: 15 minutes by default, 2 minutes in the demo, and three days after the due date for cash.
`/api/cron/expire-payments` asks the provider one last time, then marks the payment `EXPIRED`. On the free Vercel plan this job runs once a day.
That is why the same check also runs every time a payment is read (`freshen`): the screen never shows a payment as pending after its deadline, whatever the cron schedule.
If the money really moved after the deadline, a verified late confirmation can still take the payment from `EXPIRED` to `CONFIRMED`. If the share was paid another way in the meantime, it goes to `NEEDS_REVIEW` so it can be refunded.

**2. The confirmation arrives twice.**
Four safeguards, each enough on its own:
- `WebhookEvent (provider, eventId)` is unique. A redelivered event gets a 200 and changes nothing.
- Status changes use compare-and-set (`updateMany where status = current`), so only one writer wins.
- `Contribution (membershipId, cycleId)` is unique. A share is counted once, whatever the payment.
- Confirmation runs in a serializable transaction, retried up to three times on a conflict.

On the client, an `Idempotency-Key` and a partial unique index (one `INITIATED` or `PENDING` attempt per share) mean a double tap never starts two payments.

**3. Someone sends a fake confirmation.**
- Wave: HMAC-SHA256 of `timestamp + raw body`, compared in constant time, rejected when older than 5 minutes.
- Orange Money: the `notif_token` returned when the payment is created is stored as a hash and compared in constant time.
- A valid webhook only triggers a check. The amount and the status always come from a server-to-server call to the provider. A different amount or currency sends the payment to `NEEDS_REVIEW`. It is never counted.
- Rejected attempts are stored with `signatureOk = false`.
- The `/pay/return` page proves nothing by itself. It only shows what the server verified.

## What is not proven yet

- The Wave and Orange Money code follows their public documentation and is covered by tests with simulated responses. It has not run against a real merchant account, so field names and edge cases still need to be confirmed there.
- The order of turns is preset in the demo. The seeded draw in `src/lib/draw.ts` is written and tested, and will run when circle creation is built.
- Phone sign-in needs an SMS provider. The demo uses anonymous sessions.
- There is no rate limiting on public endpoints yet, and no full Content-Security-Policy.
- Anonymous demo users are not cleaned up automatically.

## Tests

```bash
npm test             # all tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
```

The tests cover all the code that is not a screen: the payment rules, the three webhook routes, every API route, the data layer, the demo data and the translations. Screens are checked by hand in the running app. End-to-end tests are on the roadmap.
