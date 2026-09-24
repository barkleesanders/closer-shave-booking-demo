// All D1 queries for the demo. Prepared statements everywhere.
import type { Booking, Service, ShopHours } from './types';

export async function listServices(db: D1Database): Promise<Service[]> {
  const res = await db
    .prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC')
    .all<Service>();
  return res.results ?? [];
}

export async function getServiceBySlug(db: D1Database, slug: string): Promise<Service | null> {
  return await db
    .prepare('SELECT * FROM services WHERE slug = ?1 AND is_active = 1')
    .bind(slug)
    .first<Service>();
}

export async function listShopHours(db: D1Database): Promise<ShopHours[]> {
  const res = await db.prepare('SELECT * FROM shop_hours').all<ShopHours>();
  return res.results ?? [];
}

/** Confirmed bookings overlapping [fromTs, toTs), excluding one booking (reschedule). */
export async function listBusyRangesExcluding(
  db: D1Database,
  fromTs: number,
  toTs: number,
  excludeId: string,
): Promise<Pick<Booking, 'start_ts' | 'end_ts'>[]> {
  const res = await db
    .prepare(
      `SELECT start_ts, end_ts FROM bookings
       WHERE status = 'confirmed' AND id <> ?3 AND start_ts < ?2 AND end_ts > ?1
       ORDER BY start_ts ASC`,
    )
    .bind(fromTs, toTs, excludeId)
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
/** Confirmed bookings overlapping [fromTs, toTs). Used for slot generation. */
export async function listBookingsInRange(
  db: D1Database,
  fromTs: number,
  toTs: number,
): Promise<Pick<Booking, 'start_ts' | 'end_ts'>[]> {
  const res = await db
    .prepare(
      `SELECT start_ts, end_ts FROM bookings
       WHERE status = 'confirmed' AND start_ts < ?2 AND end_ts > ?1
       ORDER BY start_ts ASC`,
    )
    .bind(fromTs, toTs)
    .all<Pick<Booking, 'start_ts' | 'end_ts'>>();
  return res.results ?? [];
}

/** True when any confirmed booking overlaps [startTs, endTs). */
export async function hasBookingConflict(
  db: D1Database,
  startTs: number,
  endTs: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM bookings
       WHERE status = 'confirmed' AND start_ts < ?2 AND end_ts > ?1
       LIMIT 1`,
    )
    .bind(startTs, endTs)
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
         (id, service_id, barber, guest_name, guest_phone, guest_email, notes, start_ts, end_ts)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE status = 'confirmed' AND barber = ?3 AND start_ts < ?9 AND end_ts > ?8
       )`,
    )
    .bind(
      b.id,
      b.service_id,
      b.barber,
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
  barber: string,
  startTs: number,
  endTs: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE bookings
       SET start_ts = ?2, end_ts = ?3, reminder_sent = 0
       WHERE id = ?1 AND status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM bookings
           WHERE status = 'confirmed' AND id <> ?1 AND barber = ?4
             AND start_ts < ?3 AND end_ts > ?2
         )`,
    )
    .bind(id, startTs, endTs, barber)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export interface NewBooking {
  id: string;
  service_id: string;
  barber: string;
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
         (id, service_id, barber, guest_name, guest_phone, guest_email, notes, start_ts, end_ts)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      b.id,
      b.service_id,
      b.barber,
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

export async function listUpcomingBookings(db: D1Database, limit = 100): Promise<(Booking & { service_name: string })[]> {
  const res = await db
    .prepare(
      `SELECT b.*, s.name AS service_name FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.status = 'confirmed' AND b.start_ts >= ?1
       ORDER BY b.start_ts ASC LIMIT ?2`,
    )
    .bind(Date.now(), limit)
    .all<Booking & { service_name: string }>();
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
