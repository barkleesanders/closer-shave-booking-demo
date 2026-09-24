// Demo admin: upcoming bookings + cancel. Protected by HTTP Basic auth:
// any username, ADMIN_KEY (wrangler secret) as the password, compared in
// constant time. Credentials ride in the Authorization header instead of the
// URL, so they don't leak into history, referrers, or server logs.
// Demo-grade auth: fine for a concept demo, not for real customer data.
import { Hono } from 'hono';
import {
  cancelBooking,
  listAllServices,
  listShopHours,
  listUpcomingBookings,
  updateService,
  updateShopHours,
} from '../db';
import { adminConfigPage, adminPage, errorPage } from '../templates/pages';
import type { Bindings } from '../types';

/** Constant-time string comparison (demo-grade; avoids trivial timing leaks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

adminRoutes.use('*', async (c, next) => {
  const configured = c.env.ADMIN_KEY;
  if (!configured) {
    return c.html(errorPage('Admin unavailable', 'ADMIN_KEY is not configured on this deployment.'), 503);
  }
  const header = c.req.header('authorization') ?? '';
  const m = /^Basic (.+)$/.exec(header);
  let provided = '';
  if (m) {
    try {
      const decoded = atob(m[1]);
      const idx = decoded.indexOf(':');
      provided = idx >= 0 ? decoded.slice(idx + 1) : decoded;
    } catch {
      provided = '';
    }
  }
  if (!provided || !safeEqual(provided, configured)) {
    return c.html(errorPage('Forbidden', 'Admin credentials are required.'), 401, {
      'WWW-Authenticate': 'Basic realm="closer-shave-demo-admin"',
    });
  }
  await next();
});

adminRoutes.get('/', async (c) => {
  const bookings = await listUpcomingBookings(c.env.DB);
  return c.html(adminPage(bookings));
});

adminRoutes.post('/cancel', async (c) => {
  const form = await c.req.parseBody();
  const id = typeof form.id === 'string' ? form.id : '';
  if (!/^CSH-[A-Z0-9]{6}$/.test(id)) {
    return c.html(errorPage('Bad request', 'Invalid booking reference.'), 400);
  }
  const ok = await cancelBooking(c.env.DB, id);
  console.log(JSON.stringify({ msg: 'admin_cancel', id, ok }));
  return c.redirect('/admin', 303);
});

adminRoutes.get('/config', async (c) => {
  const [services, hours] = await Promise.all([listAllServices(c.env.DB), listShopHours(c.env.DB)]);
  return c.html(adminConfigPage(services, hours));
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

adminRoutes.post('/config/services', async (c) => {
  const form = await c.req.parseBody();
  const services = await listAllServices(c.env.DB);
  for (const s of services) {
    const durRaw = form[`svc_${s.id}_duration`];
    const priceRaw = form[`svc_${s.id}_price`];
    const duration = typeof durRaw === 'string' ? Number(durRaw) : NaN;
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      return c.html(adminConfigPage(services, await listShopHours(c.env.DB), `Invalid duration for ${s.name} (5–480 min).`), 400);
    }
    let priceCents: number | null = null;
    if (typeof priceRaw === 'string' && priceRaw.trim() !== '') {
      const dollars = Number(priceRaw);
      if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100000) {
        return c.html(adminConfigPage(services, await listShopHours(c.env.DB), `Invalid price for ${s.name}.`), 400);
      }
      priceCents = Math.round(dollars * 100);
    }
    const active = form[`svc_${s.id}_active`] === 'on' ? 1 : 0;
    await updateService(c.env.DB, s.id, { duration_minutes: duration, price_cents: priceCents, is_active: active });
  }
  console.log(JSON.stringify({ msg: 'admin_services_updated', count: services.length }));
  const [fresh, hours] = await Promise.all([listAllServices(c.env.DB), listShopHours(c.env.DB)]);
  return c.html(adminConfigPage(fresh, hours, 'Services saved.'));
});

adminRoutes.post('/config/hours', async (c) => {
  const form = await c.req.parseBody();
  for (let dow = 0; dow < 7; dow++) {
    const open = typeof form[`hr_${dow}_open`] === 'string' ? (form[`hr_${dow}_open`] as string) : '';
    const close = typeof form[`hr_${dow}_close`] === 'string' ? (form[`hr_${dow}_close`] as string) : '';
    const closed = form[`hr_${dow}_closed`] === 'on' ? 1 : 0;
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      const [services, hours] = await Promise.all([listAllServices(c.env.DB), listShopHours(c.env.DB)]);
      return c.html(adminConfigPage(services, hours, 'Hours must be HH:MM (24-hour).'), 400);
    }
    if (!closed && open >= close) {
      const [services, hours] = await Promise.all([listAllServices(c.env.DB), listShopHours(c.env.DB)]);
      return c.html(adminConfigPage(services, hours, 'Opening time must be before closing time.'), 400);
    }
    await updateShopHours(c.env.DB, dow, { open_time: open, close_time: close, is_closed: closed });
  }
  console.log(JSON.stringify({ msg: 'admin_hours_updated' }));
  const [services, hours] = await Promise.all([listAllServices(c.env.DB), listShopHours(c.env.DB)]);
  return c.html(adminConfigPage(services, hours, 'Hours saved.'));
});
