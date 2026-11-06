// Closer Shave booking demo — composition root.
// Unofficial concept demo. Not affiliated with The Closer Shave.
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { runReminderSweep } from './reminders';
import { adminRoutes } from './routes/admin';
import { bookingRoutes } from './routes/booking';
import { errorPage } from './templates/pages';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

app.use(secureHeaders());

// Cache layering (Lockyer Rules 5-6). Public catalog-style GETs (barbers,
// services, bookable dates) change only when an admin edits config, so they
// get a short shared-cache policy. Everything else is deliberately NOT
// publicly cached: /api/slots is live availability, /book/:id carries guest
// details, /admin/* is authenticated, and every POST mutates state — those
// get an explicit private, no-store. Only 200 GET responses gain a public
// policy; errors and redirects stay no-store.
const CACHE_PUBLIC_SHORT = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';
const CACHE_PAGE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
const CACHE_NO_STORE = 'private, no-store';
app.use('*', async (c, next) => {
  await next();
  if (c.res.headers.has('Cache-Control')) return;
  const path = new URL(c.req.url).pathname;
  // HEAD mirrors GET for cache policy (monitors and curl -I use it).
  const isGet = c.req.method === 'GET' || c.req.method === 'HEAD';
  let value = CACHE_NO_STORE;
  if (isGet && c.res.status === 200) {
    if (path === '/') value = CACHE_PAGE;
    else if (path === '/api/barbers' || path === '/api/services' || path === '/api/dates')
      value = CACHE_PUBLIC_SHORT;
  }
  c.header('Cache-Control', value);
});

// Admin auth routes must not exist here; /admin/* is Basic-auth gated in adminRoutes.
app.route('/admin', adminRoutes);

// Best-effort abuse throttle on the public booking endpoint.
// Per-isolate token bucket (not global across edge isolates): 10 bookings
// per minute per client IP. Honest residual risk is documented in README.md.
const buckets = new Map<string, { count: number; reset: number }>();
app.use('/api/book', async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
  } else if (b.count >= 10) {
    return c.html(
      errorPage('Slow down', 'Too many booking attempts — please wait a minute and try again.'),
      429,
    );
  } else {
    b.count++;
  }
  if (buckets.size > 5000) buckets.clear(); // bound memory on a hot isolate
  await next();
});

app.route('/', bookingRoutes);

app.notFound((c) => c.html(errorPage('Not found', 'That page does not exist.'), 404));

app.onError((err, c) => {
  console.error(JSON.stringify({ msg: 'unhandled_error', err: String(err).slice(0, 500) }));
  return c.html(errorPage('Something went wrong', 'Please try again in a moment.'), 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext): Promise<void> {
    await runReminderSweep(env);
  },
};
