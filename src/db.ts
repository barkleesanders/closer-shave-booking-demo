// All D1 queries for the demo. Prepared statements everywhere.
import type { Barber, Booking, DayWindow, Service, ShopHours } from './types';

/** Active barbers, display order. */
export async function listBarbers(db: D1Database): Promise<Barber[]> {
  const res = await db
    .prepare('SELECT * FROM barbers WHERE is_active = 1 ORDER BY sort_order ASC')
    .all<BarberRow>();
  return (res.results ?? []).map(parseBarber);
}

export async function getBarberById(db: D1Database, id: string): Promise<Barber | null> {
  const row = await db
    .prepare('SELECT * FROM barbers WHERE id = ?1 AND is_active = 1')
    .bind(id)
    .first<BarberRow>();
  return row ? parseBarber(row) : null;
}

/**
 * D1 returns gallery_images as a JSON string (or leaves it undefined when the
 * column does not exist, e.g. a database that predates migration 0004).
 * Parse defensively: anything that is not an array of URL strings becomes [].
 */
type BarberRow = Omit<Barber, 'gallery_images'> & { gallery_images?: string | null };

export function parseBarber(row: BarberRow): Barber {
  let gallery_images: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.gallery_images ?? '[]');
    if (Array.isArray(parsed)) {
      gallery_images = parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
    }
  } catch {
    gallery_images = [];
  }
  const { gallery_images: _drop, ...rest } = row;
  return { ...rest, gallery_images };
}

/** A barber's open windows, ordered by weekday then window (split shifts). */
export async function listBarberHours(db: D1Database, barberId: string): Promise<DayWindow[]> {
  const res = await db
    .prepare(
      `SELECT day_of_week, open_time, close_time FROM barber_hours
       WHERE barber_id = ?1 ORDER BY day_of_week ASC, window_index ASC`,
    )
    .bind(barberId)
    .all<DayWindow>();
  return res.results ?? [];
}

/** Hours for every active barber, keyed by barber id (one query). */
export async function listAllBarberHours(db: D1Database): Promise<Map<string, DayWindow[]>> {
  const res = await db
    .prepare(
      `SELECT h.barber_id, h.day_of_week, h.open_time, h.close_time FROM barber_hours h
       JOIN barbers b ON b.id = h.barber_id AND b.is_active = 1
       ORDER BY h.barber_id ASC, h.day_of_week ASC, h.window_index ASC`,
    )
    .all<DayWindow & { barber_id: string }>();
  const map = new Map<string, DayWindow[]>();
  for (const row of res.results ?? []) {
    const arr = map.get(row.barber_id) ?? [];
    arr.push({ day_of_week: row.day_of_week, open_time: row.open_time, close_time: row.close_time });
    map.set(row.barber_id, arr);
  }
  return map;
}

/** Active services for one barber. */
export async function listServicesForBarber(db: D1Database, barberId: string): Promise<Service[]> {
  const res = await db
    .prepare(
      'SELECT * FROM services WHERE is_active = 1 AND barber_id = ?1 ORDER BY sort_order ASC',
    )
    .bind(barberId)
    .all<Service>();
  return res.results ?? [];
}

export async function getServiceForBarber(
  db: D1Database,
  barberId: string,
  slug: string,
): Promise<Service | null> {
  return await db
    .prepare('SELECT * FROM services WHERE slug = ?1 AND barber_id = ?2 AND is_active = 1')
    .bind(slug, barberId)
    .first<Service>();
}

/** @deprecated Multi-barber: use listServicesForBarber. Kept for the admin config editor. */
export async function listServices(db: D1Database): Promise<Service[]> {
  const res = await db
    .prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC')
    .all<Service>();
  return res.results ?? [];
}

export async function listShopHours(db: D1Database): Promise<ShopHours[]> {
  const res = await db.prepare('SELECT * FROM shop_hours').all<ShopHours>();
  return res.results ?? [];
}

/** Confirmed bookings overlapping [fromTs, toTs), excluding one booking (reschedule). Scoped to one barber. */
export async function listBusyRangesExcluding(
  db: D1Database,
  fromTs: number,
  toTs: number,
  excludeId: string,
  barberId: string,
): Promise<Pick<Booking, 'start_ts' | 'end_ts'>[]> {
  const res = await db
    .prepare(
      `SELECT start_ts, end_ts FROM bookings
       WHERE status = 'confirmed' AND id <> ?3 AND barber_id = ?4
         AND start_ts < ?2 AND end_ts > ?1
       ORDER BY start_ts ASC`,
    )
    .bind(fromTs, toTs, excludeId, barberId)
    .all<Pick<Booking, 'start_ts' | 'end_ts'>>();
  return res.results ?? [];
}

/** All services, including inactive (admin view). */
export async function listAllServices(db: D1Database): Promise<Service[]> {
  const res = await db
    .prepare('SELECT * FROM services ORDER BY sort_order ASC')
    .all<Service>();
  return res.results ?? [];
}

export interface ServiceConfig {
  duration_minutes: number;
  price_cents: number | null;
  is_active: number;
}

export async function updateService(
  db: D1Database,
  id: string,
  cfg: ServiceConfig,
): Promise<void> {
  await db
    .prepare(
      `UPDATE services
       SET duration_minutes = ?2, price_cents = ?3, is_active = ?4
       WHERE id = ?1`,
    )
    .bind(id, cfg.duration_minutes, cfg.price_cents, cfg.is_active)
    .run();
}

export interface ShopHoursConfig {
  open_time: string;
  close_time: string;
  is_closed: number;
}

export interface BarberHoursConfig {
  open_time: string;
  close_time: string;
}

/** Admin: replace all windows for one barber weekday (split shifts included). */
export async function updateBarberHours(
  db: D1Database,
  barberId: string,
  dayOfWeek: number,
  windows: BarberHoursConfig[],
): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM barber_hours WHERE barber_id = ?1 AND day_of_week = ?2').bind(barberId, dayOfWeek),
  ];
  windows.forEach((w, i) => {
    stmts.push(
      db
        .prepare(
          'INSERT INTO barber_hours (barber_id, day_of_week, window_index, open_time, close_time) VALUES (?1, ?2, ?3, ?4, ?5)',
        )
        .bind(barberId, dayOfWeek, i, w.open_time, w.close_time),
    );
  });
  await db.batch(stmts);
}

export async function updateShopHours(
  db: D1Database,
  dayOfWeek: number,
  cfg: ShopHoursConfig,
): Promise<void> {
  await db
    .prepare(
      `UPDATE shop_hours
       SET open_time = ?2, close_time = ?3, is_closed = ?4
       WHERE day_of_week = ?1`,
    )
    .bind(dayOfWeek, cfg.open_time, cfg.close_time, cfg.is_closed)
    .run();
}
/** Confirmed bookings overlapping [fromTs, toTs). Scoped to one barber. Used for slot generation. */
export async function listBookingsInRange(
  db: D1Database,
  fromTs: number,
  toTs: number,
  barberId: string,
): Promise<Pick<Booking, 'start_ts' | 'end_ts'>[]> {
  const res = await db
    .prepare(
      `SELECT start_ts, end_ts FROM bookings
       WHERE status = 'confirmed' AND barber_id = ?3 AND start_ts < ?2 AND end_ts > ?1
       ORDER BY start_ts ASC`,
    )
    .bind(fromTs, toTs, barberId)
    .all<Pick<Booking, 'start_ts' | 'end_ts'>>();
  return res.results ?? [];
}

/** True when any confirmed booking for the barber overlaps [startTs, endTs). */
export async function hasBookingConflict(
  db: D1Database,
  startTs: number,
  endTs: number,
  barberId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM bookings
       WHERE status = 'confirmed' AND barber_id = ?3 AND start_ts < ?2 AND end_ts > ?1
       LIMIT 1`,
    )
    .bind(startTs, endTs, barberId)
    .first<{ 1: number }>();
  return row !== null;
}

/**
 * Atomically insert a booking only when no confirmed booking for the same
 * barber overlaps [startTs, endTs). This is ONE SQL statement, so SQLite
 * executes it without interleaving: two concurrent booking POSTs for the
 * same slot cannot both succeed. Returns false when the slot is taken.
 */
export async function insertBookingIfFree(db: D1Database, b: NewBooking): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO bookings
         (id, service_id, barber, barber_id, guest_name, guest_phone, guest_email, notes, start_ts, end_ts)
       SELECT ?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE status = 'confirmed' AND barber_id = ?3 AND start_ts < ?9 AND end_ts > ?8
       )`,
    )
    .bind(
      b.id,
      b.service_id,
      b.barber_id,
      b.guest_name,
      b.guest_phone,
      b.guest_email,
      b.notes,
      b.start_ts,
      b.end_ts,
    )
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Atomically move a confirmed booking to a new time window. One statement:
 * the move happens only when no OTHER confirmed booking for the same barber
 * overlaps the new window. Returns false when the new slot is taken.
 */
export async function rescheduleBooking(
  db: D1Database,
  id: string,
  barberId: string,
  startTs: number,
  endTs: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE bookings
       SET start_ts = ?2, end_ts = ?3, reminder_sent = 0
       WHERE id = ?1 AND status = 'confirmed' AND barber_id = ?4
         AND NOT EXISTS (
           SELECT 1 FROM bookings
           WHERE status = 'confirmed' AND id <> ?1 AND barber_id = ?4
             AND start_ts < ?3 AND end_ts > ?2
         )`,
    )
    .bind(id, startTs, endTs, barberId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export interface NewBooking {
  id: string;
  service_id: string;
  barber_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  notes: string | null;
  start_ts: number;
  end_ts: number;
}

export async function insertBooking(db: D1Database, b: NewBooking): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bookings
         (id, service_id, barber, barber_id, guest_name, guest_phone, guest_email, notes, start_ts, end_ts)
       VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      b.id,
      b.service_id,
      b.barber_id,
      b.guest_name,
      b.guest_phone,
      b.guest_email,
      b.notes,
      b.start_ts,
      b.end_ts,
    )
    .run();
}

export async function getBooking(db: D1Database, id: string): Promise<Booking | null> {
  return await db.prepare('SELECT * FROM bookings WHERE id = ?1').bind(id).first<Booking>();
}

export async function listUpcomingBookings(
  db: D1Database,
  limit = 100,
  barberId?: string,
): Promise<(Booking & { service_name: string; barber_name: string })[]> {
  const where = barberId
    ? `WHERE b.status = 'confirmed' AND b.start_ts >= ?1 AND b.barber_id = ?3`
    : `WHERE b.status = 'confirmed' AND b.start_ts >= ?1`;
  const res = await db
    .prepare(
      `SELECT b.*, s.name AS service_name, COALESCE(br.name, b.barber) AS barber_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN barbers br ON br.id = b.barber_id
       ${where}
       ORDER BY b.start_ts ASC LIMIT ?2`,
    )
    .bind(Date.now(), limit, ...(barberId ? [barberId] : []))
    .all<Booking & { service_name: string; barber_name: string }>();
  return res.results ?? [];
}

export async function cancelBooking(db: D1Database, id: string): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?1 AND status = 'confirmed'`)
    .bind(id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Bookings needing a confirmation email (booked but confirmation not yet sent). */
export async function listPendingConfirmations(db: D1Database): Promise<Booking[]> {
  const res = await db
    .prepare(
      `SELECT * FROM bookings
       WHERE status = 'confirmed' AND confirmation_sent = 0 AND guest_email IS NOT NULL
         AND start_ts > ?1 ORDER BY start_ts ASC LIMIT 50`,
    )
    .bind(Date.now())
    .all<Booking>();
  return res.results ?? [];
}

/** Bookings starting within [windowStart, windowEnd) with no reminder sent yet. */
export async function listPendingReminders(
  db: D1Database,
  windowStart: number,
  windowEnd: number,
): Promise<Booking[]> {
  const res = await db
    .prepare(
      `SELECT * FROM bookings
       WHERE status = 'confirmed' AND reminder_sent = 0 AND guest_email IS NOT NULL
         AND start_ts >= ?1 AND start_ts < ?2 ORDER BY start_ts ASC LIMIT 50`,
    )
    .bind(windowStart, windowEnd)
    .all<Booking>();
  return res.results ?? [];
}

export async function markConfirmationSent(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE bookings SET confirmation_sent = 1 WHERE id = ?1`).bind(id).run();
}

export async function markReminderSent(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE bookings SET reminder_sent = 1 WHERE id = ?1`).bind(id).run();
}
