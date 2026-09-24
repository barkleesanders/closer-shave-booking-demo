# The Closer Shave — booking concept demo

**CONCEPT DEMO — not affiliated with The Closer Shave.** This is an unofficial
exploration of low-cost online booking for barbershops, built on Cloudflare
Workers + D1 (Hono, TypeScript, zero build step for the frontend).

## Live deployment

- Site: <https://closer-shave-booking-demo.barkleesanders.workers.dev>
- Repo: <https://github.com/barkleesanders/closer-shave-booking-demo>
- Worker: `closer-shave-booking-demo` · D1: `closer-shave-booking`
  (`df548d2e-32f8-43c6-9330-ce913c712caa`)
- Reminders cron: `*/30 * * * *` (scheduled handler in `src/index.ts`,
  `src/reminders.ts`)
- Email: demo mode — no `RESEND_API_KEY` configured, so confirmations log to
  the console instead of sending.
- Admin (`/admin`): HTTP Basic auth via `ADMIN_KEY` wrangler secret.
- E2E verified live 2026-09-24: TEST booking `CSH-AB9Z9T` created (303),
  duplicate slot attempt rejected (409), rescheduled 10:30 AM → 10:45 AM
  (303, confirmed on the ticket page and in D1), cancelled (200, D1 status
  `cancelled`). Exactly one confirmed row existed for the slot — the atomic
  single-statement insert held.

## Shop facts (re-verified live 2026-09-24)

- The Closer Shave · 411A Brannan St, San Francisco, CA 94107 · (415) 465-5915
- Barber: `itsrjstyles` (Ricky)
- Services, prices, durations: Booksy provider listing
  <https://booksy.com/en-us/1150634_itsrjstyles_barber-shop_134715_san-francisco>
  (21 services, $52–$181, 30–90 min)
- Hours: Booksy shop listing
  <https://booksy.com/en-us/1150636_the-closer-shave_barber-shop_134715_san-francisco>
  (Sun 11–6, Mon closed, Tue 2–6, Wed 11–7:30, Thu 2–8, Fri 10:30–8, Sat 11–6)
- Ratings: Booksy 5.0 (319 shop / 96 barber reviews), NxCut 4.5 (439)
- Individual Booksy review text is JS-rendered and isn't statically
  retrievable; the site links to the live listings instead of quoting them.
  (Re-verified 2026-09-24: the shop listing's static render shows
  "No Reviews Yet..." for review text while still reporting 5.0 / 319 reviews
  in aggregate.)
- Data nuance (found during verification, not yet changed): the demo's
  availability grid uses the SHOP listing hours, but the BARBER listing
  (itsrjstyles) shows narrower hours — Sun/Sat 12:00–17:00, Tue/Fri
  12:00–20:00, Thu 12:00–20:30. Since booking is with the barber, per-barber
  hours would be more accurate; the seed currently uses shop hours. Open
  decision for the shop owner.
- Photos hotlink the shop's public Booksy CDN images, attributed on-page.

Do not contact the shop. No real branding assets beyond the factual name,
address, phone, barber name, and public prices.

## Develop

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run dev         # wrangler dev (local)
```

Local D1 test:

```bash
npx wrangler d1 execute closer-shave-booking --local --file migrations/0001_schema.sql
npx wrangler d1 execute closer-shave-booking --local --file migrations/0002_seed.sql
npm run dev
# open http://localhost:8787 — book, confirm, cancel via /admin
```

## Deploy (authorized)

```bash
# one-time: create DB, then set the real id in wrangler.toml
npx wrangler d1 create closer-shave-booking
npx wrangler d1 execute closer-shave-booking --remote --file migrations/0001_schema.sql
npx wrangler d1 execute closer-shave-booking --remote --file migrations/0002_seed.sql
# generate and set secrets (never commit)
openssl rand -base64 32 | npx wrangler secret put ADMIN_KEY
# optional: npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Admin (`/admin`) uses HTTP Basic auth: any username, `ADMIN_KEY` as password.
Without `ADMIN_KEY` the admin routes return 503.

## Email

Resend seam only. With no `RESEND_API_KEY` set, the worker is in **demo
mode**: nothing is sent; attempts are logged PII-free (booking id +
recipient presence, never the address). Only a confirmed send marks mail
sent in the database.

## Security notes (honest, demo-grade)

- Input is validated server-side; slots are revalidated against D1 before
  insert; booking IDs are unguessable (`CSH-` + 6 unambiguous chars).
- `/api/book` has a best-effort per-isolate throttle: 10 POSTs/min per IP.
  It is NOT global across edge isolates and NOT a substitute for
  Cloudflare Rate Limiting or Turnstile on a production deployment.
- Admin auth is HTTP Basic over TLS with a strong random secret — fine for a
  demo, not for real customer data (no session expiry, no MFA).
- The site sends `noindex,nofollow` and carries the "concept demo — not
  affiliated" banner on every page.
