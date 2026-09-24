// Demo admin: upcoming bookings + cancel, per-barber. Protected by HTTP Basic
// auth: any username, ADMIN_KEY (wrangler secret) as the password, compared in
// constant time. Credentials ride in the Authorization header instead of the
// URL, so they don't leak into history, referrers, or server logs.
// Demo-grade auth: fine for a concept demo, not for real customer data.
import { Hono } from 'hono';
import {
  cancelBooking,
  getBarberById,
  listAllBarberHours,
  listAllServices,
  listBarbers,
  listUpcomingBookings,
  updateService,
} from '../db';
import { adminConfigPage, adminPage, errorPage } from '../templates/pages';
import type { Bindings, DayWindow } from '../types';

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
  const barbers = await listBarbers(c.env.DB);
  const filter = (c.req.query('barber') ?? '').trim();
  const barber = filter ? await getBarberById(c.env.DB, filter) : null;
  const bookings = await listUpcomingBookings(c.env.DB, 100, barber ? barber.id : undefined);
  return c.html(adminPage(bookings, barbers, barber?.id ?? ''));
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
  const [services, barbers, hoursMap] = await Promise.all([
    listAllServices(c.env.DB),
    listBarbers(c.env.DB),
    listAllBarberHours(c.env.DB),
  ]);
  return c.html(adminConfigPage(services, barbers, hoursMap));
});

adminRoutes.post('/config/services', async (c) => {
  const form = await c.req.parseBody();
  const services = await listAllServices(c.env.DB);
  for (const s of services) {
    const durRaw = form[`svc_${s.id}_duration`];
    const priceRaw = form[`svc_${s.id}_price`];
    const duration = typeof durRaw === 'string' ? Number(durRaw) : NaN;
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      const fresh = await adminConfigData(c);
      return c.html(adminConfigPage(fresh.services, fresh.barbers, fresh.hoursMap, `Invalid duration for ${s.name} (5–480 min).`), 400);
    }
    let priceCents: number | null = null;
    if (typeof priceRaw === 'string' && priceRaw.trim() !== '') {
      const dollars = Number(priceRaw);
      if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100000) {
        const fresh = await adminConfigData(c);
        return c.html(adminConfigPage(fresh.services, fresh.barbers, fresh.hoursMap, `Invalid price for ${s.name}.`), 400);
      }
      priceCents = Math.round(dollars * 100);
    }
    const active = form[`svc_${s.id}_active`] === 'on' ? 1 : 0;
    await updateService(c.env.DB, s.id, { duration_minutes: duration, price_cents: priceCents, is_active: active });
  }
  console.log(JSON.stringify({ msg: 'admin_services_updated', count: services.length }));
  const fresh = await adminConfigData(c);
  return c.html(adminConfigPage(fresh.services, fresh.barbers, fresh.hoursMap, 'Services saved.'));
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Parse a day's windows from "HH:MM-HH:MM, HH:MM-HH:MM" (blank = closed). */
export function parseDayWindows(raw: string): { windows: [string, string][]; error?: string } {
  const text = raw.trim();
  if (!text) return { windows: [] };
  const windows: [string, string][] = [];
  for (const part of text.split(',')) {
    const m = /^\s*([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)\s*$/.exec(part);
    if (!m) return { windows: [], error: `Bad window "${part.trim()}" — use HH:MM-HH:MM.` };
    const open = `${m[1]}:${m[2]}`;
    const close = `${m[3]}:${m[4]}`;
    if (open >= close) return { windows: [], error: `Opening time must be before closing time in "${part.trim()}".` };
    windows.push([open, close]);
  }
  // Windows must not overlap each other.
  const sorted = [...windows].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] < sorted[i - 1][1])
      return { windows: [], error: `Windows overlap: "${sorted[i - 1][0]}-${sorted[i - 1][1]}" and "${sorted[i][0]}-${sorted[i][1]}".` };
  }
  return { windows };
}

async function adminConfigData(c: { env: Bindings }) {
  const [services, barbers, hoursMap] = await Promise.all([
    listAllServices(c.env.DB),
    listBarbers(c.env.DB),
    listAllBarberHours(c.env.DB),
  ]);
  return { services, barbers, hoursMap };
}

async function replaceBarberHours(db: D1Database, barberId: string, byDay: Map<number, DayWindow[]>): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM barber_hours WHERE barber_id = ?1').bind(barberId),
  ];
  for (const [dow, windows] of byDay) {
    windows.forEach((w, i) => {
      stmts.push(
        db.prepare(
          'INSERT INTO barber_hours (barber_id, day_of_week, window_index, open_time, close_time) VALUES (?1, ?2, ?3, ?4, ?5)',
        ).bind(barberId, dow, i, w.open_time, w.close_time),
      );
    });
  }
  await db.batch(stmts);
}

adminRoutes.post('/config/hours', async (c) => {
  const form = await c.req.parseBody();
  const barbers = await listBarbers(c.env.DB);
  const ids = new Set(barbers.map((b) => b.id));

  // Parse and validate every barber's week first; write nothing on error.
  const parsed = new Map<string, Map<number, DayWindow[]>>();
  for (const b of barbers) {
    const byDay = new Map<number, DayWindow[]>();
    for (let dow = 0; dow < 7; dow++) {
      const raw = typeof form[`bh_${b.id}_${dow}`] === 'string' ? (form[`bh_${b.id}_${dow}`] as string) : '';
      const { windows, error } = parseDayWindows(raw);
      if (error) {
        const fresh = await adminConfigData(c);
        return c.html(adminConfigPage(fresh.services, fresh.barbers, fresh.hoursMap, `${b.name}: ${error}`), 400);
      }
      byDay.set(
        dow,
        windows.map(([open_time, close_time]) => ({ day_of_week: dow, open_time, close_time })),
      );
    }
    parsed.set(b.id, byDay);
  }
  for (const [barberId, byDay] of parsed) {
    if (!ids.has(barberId)) continue;
    await replaceBarberHours(c.env.DB, barberId, byDay);
  }
  console.log(JSON.stringify({ msg: 'admin_barber_hours_updated' }));
  const fresh = await adminConfigData(c);
  return c.html(adminConfigPage(fresh.services, fresh.barbers, fresh.hoursMap, 'Hours saved.'));
});
