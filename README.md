<div align="center">

<img src="public/assets/ikaton-logo-full.png" alt="Ikàton" height="72" />

### The tontine, kept straight.

A mobile-first web app for rotating savings circles (*tontines*) in Mali:
everyone pays in, everyone gets their turn, and every franc is counted exactly once.

[**Live demo**](https://ikaton-app.vercel.app) · [Case study on Behance](https://www.behance.net/gallery/258370987/Ikaton-mobile-app-UXUI-case-study) · [Engineering notes](docs/ENGINEERING_NOTES.md)

[![CI](https://github.com/admaia/Ikaton-app/actions/workflows/ci.yml/badge.svg)](https://github.com/admaia/Ikaton-app/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=admaia_Ikaton-app&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=admaia_Ikaton-app)

</div>

---

## The problem

A tontine is a savings circle: a group of people pays the same amount every week or month, and each cycle one member receives the whole pot. It is a very common way to save in Mali and across West Africa.

I grew up around tontines in Mali. The ones I know are run from a paper notebook or notes on a phone. That works until people forget who paid, who still owes and whose turn it is. Then the arguments start.

**Ikàton** keeps the notebook for the group: who paid, who is next, and a ledger where lines are added, never edited.

> The app is built for tontine groups in Mali, so French is a first-class language. The live demo opens in English; switch with **Français** on the showcase page or in the profile.

## Try it in one click

No phone number needed. On the live demo, tap **Try the demo**:

- You land in four ready-made circles. You are a **member** in two (one has a share to pay) and the **organiser** of the other two (one has cash deposits to validate). Roles belong to a circle, not to a person.
- When you pay, you play the mobile-money operator. You choose what happens and see exactly how the server reacts:

| You choose | What the server does |
|---|---|
| Approve the payment | Verifies with the operator, counts the share once |
| Decline | Marks the payment failed, nothing is counted |
| Don't answer | Expires the payment after 2 minutes, nothing is counted |
| Confirm twice | Counts the first, ignores the duplicates |
| Forged confirmation | Rejects the forged, unsigned and replayed messages |

On a computer, the app runs live inside a phone frame next to the project description. On a phone, it is installable as an app (PWA).

## Screenshots

Screens from the live demo.

| Home | Circle | Payment | Payout |
|---|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Circle](docs/screenshots/circle.png) | ![Payment](docs/screenshots/payment.png) | ![Payout](docs/screenshots/payout.png) |

## Design first

The product was designed before any code: use cases, the payment flow, and the data model.

| Use cases | Payment sequence | Data model |
|---|---|---|
| ![Use cases](docs/diagrams/use-case.png) | ![Payment sequence](docs/diagrams/payment-sequence.png) | ![Class diagram](docs/diagrams/class-diagram.png) |

## Payment safety

If the app gets one payment wrong, people stop trusting it. So the payment flow has to answer three questions.

**What if the confirmation never arrives?**
Every payment has a deadline. A scheduled job (once a day on the free Vercel plan) asks the operator one last time, then marks the payment expired. The same check runs every time a payment is read, so the screen never shows "pending" past the deadline. If the money really did move after the deadline, a verified late confirmation can still be counted.

**What if it arrives twice?**
Four separate safeguards: every webhook event is stored once, payment status changes use compare-and-set, the database allows only one counted share per member per cycle, and confirmation runs in a serializable transaction. On the client, an idempotency key means a double tap never starts two payments.

**What if someone sends a fake one?**
Wave webhooks are checked with an HMAC signature (constant-time comparison, 5-minute replay window). Orange Money callbacks are checked against a token stored only as a hash. Even a valid webhook only *triggers* a check: the amount and status always come from a server-to-server call to the operator. A mismatch is parked for review, never counted.

**What is real and what is simulated**
The live demo uses a sandbox operator. It goes through the same code as a real provider: signed webhooks, the same checks, the same database rules. The Wave and Orange Money integrations are written from their public documentation and covered by tests. I have not run them with a real merchant account yet.

More detail in [docs/ENGINEERING_NOTES.md](docs/ENGINEERING_NOTES.md).

## Stack

**Front end:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Motion, GSAP, Lenis
**Back end:** Next.js route handlers, Prisma, PostgreSQL and Auth on Supabase, Zod
**Payments:** a sandbox operator for the demo. Wave Checkout and Orange Money WebPay are implemented, not yet run with a merchant account
**Quality:** Vitest, ESLint, TypeScript strict mode, Trivy, SonarCloud, GitHub Actions

```
src/app            screens (onboarding, home, circles, ledger, payout) and API routes
src/lib/payments   state machine, signature checks, idempotent creation, settle-once, reconciliation
src/lib            auth, data access, seeded draw, formatting, validation
tests              payments, webhooks, API routes, data access, translations
```

## Quality

- **Tests** cover the logic that moves money: the payment state machine, signature and token checks, the settle-once rules (duplicates, amount mismatch, share already paid, late confirmation) and the Wave webhook route (forged, unsigned, replayed and redelivered events). They also cover every API route, the data layer, the demo seed and the translations: all the code that is not a screen.
- **CI** runs typecheck, lint and tests with coverage on every push, then a **SonarCloud** analysis.
- **Trivy** scans dependencies, committed secrets and configuration on every push.
- **Input validation:** request bodies and ids are validated with Zod before they reach the database. A webhook is only trusted after its signature or token is checked.

## Run it locally

```bash
cp .env.example .env.local     # Supabase keys, secrets, DEMO_MODE=true
                               # put DATABASE_URL and DIRECT_URL in .env (the Prisma CLI only reads .env)
npm install
npm run db:push                # schema + database constraints (prisma/sql/constraints.sql)
npm run dev                    # then "Try the demo" creates the demo circles for you
```

```bash
npm test             # unit and route tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
```

For the one-click demo, enable **Anonymous sign-ins** in Supabase (Auth → Providers) and set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`.

## How I built this

I designed Ikàton and built it with Claude as a coding assistant. I made the decisions and I answer for the result. Here is how the work was split.

**What I decided**

- The product: what a tontine app has to fix, and what stays out of the first version.
- The system: the use cases, the payment sequence and the data model. I drew the diagrams above before any code.
- The payment rules: what happens when a confirmation is late, sent twice or forged.
- The visual direction, the logo and every screen.

**How I worked with AI**

- I wrote the engineering rules first: architecture, naming, security, testing, no filler comments.
- I gave Claude one small task at a time, with the diagram or the screen it had to match.

**How I check it**

I don't take AI-written code on trust. Every push runs TypeScript, ESLint, more than 200 tests, a Trivy security scan and SonarCloud. The tests cover all the code that is not a screen, starting with the logic that moves money. The demo operator is there so you can check the payment guarantees yourself.

## Roadmap

Not built yet: creating a circle, joining by invitation code, leaving a circle, reminders, Moov Money and card payments.

Good to know:
- The order of turns is preset in the demo. The seeded draw is written and tested, and will run when circle creation ships.
- Phone sign-in needs an SMS provider, so the demo uses anonymous sessions.

Planned next: a real merchant test with Wave or Orange Money, end-to-end tests with Playwright, rate limiting on public endpoints and a full Content-Security-Policy.

## Author

**Adama Aïssa Maïga** · Front-end developer & design engineer · Bamako, Mali
[GitHub](https://github.com/admaia) · [Behance](https://www.behance.net/gallery/258370987/Ikaton-mobile-app-UXUI-case-study)

## License

[MIT](LICENSE)
