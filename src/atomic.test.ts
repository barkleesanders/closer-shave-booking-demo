// Atomicity tests for the booking write path, executed against a REAL
// in-memory SQLite database (node:sqlite) with the production migration
// applied. D1 runs SQLite, so these statements behave identically there.
//
// The point under test: insertBookingIfFree and rescheduleBooking are each
// ONE SQL statement with a WHERE NOT EXISTS / NOT EXISTS guard, so SQLite
// executes them with no interleaving — two concurrent writers cannot both
// win the same slot. A mock would only test itself; this tests the real SQL.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  insertBookingIfFree,
  listBusyRangesExcluding,
  rescheduleBooking,
  updateService,
  updateShopHours,
  type NewBooking,
} from './db';

/** Minimal D1Database-compatible shim over node:sqlite. */
class D1Shim {
  #db: DatabaseSync;
  prepares = 0;

  constructor() {
    this.#db = new DatabaseSync(':memory:');
    const here = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(here, '..', 'migrations', '0001_schema.sql'), 'utf8');
    this.#db.exec(schema);
    // Minimal seed rows the tests need
    this.#db.exec(
      `INSERT INTO services (id, slug, name, duration_minutes, price_cents, is_active, sort_order)
       VALUES ('svc1', 'haircut', 'Haircut', 30, 7900, 1, 0);`,
    );
    for (let d = 0; d < 7; d++) {
      this.#db.prepare(
        'INSERT INTO shop_hours (day_of_week, open_time, close_time, is_closed) VALUES (?, ?, ?, 0)',
      ).run(d, '09:00', '18:00');
    }
  }

  prepare(sql: string) {
    this.prepares++;
    // db.ts uses numbered ?1..?9 placeholders, which SQLite binds BY NUMBER
    // (a repeated ?3 is the same parameter). node:sqlite only does plain ?,
    // so rebuild the positional arg list in placeholder-appearance order.
    const order: number[] = [];
    const translated = sql.replace(/\?(\d+)/g, (_m, n) => {
      order.push(Number(n) - 1);
      return '?';
    });
    const stmt = this.#db.prepare(translated);
    const positional = (args: unknown[]) => order.map((i) => args[i]);
    return {
      bind: (...args: unknown[]) => ({
        run: () => {
          const r = stmt.run(...(positional(args) as []));
          return { meta: { changes: Number(r.changes) } };
        },
        first: <T>() => (stmt.get(...(positional(args) as [])) as T | undefined) ?? null,
        all: <T>() => ({ results: (stmt.all(...(positional(args) as [])) as T[]) ?? [] }),
      }),
    };
  }
}

function db() {
  return new D1Shim() as unknown as D1Database;
}

function booking(over: Partial<NewBooking> = {}): NewBooking {
  return {
    id: 'CSH-TEST01',
    service_id: 'svc1',
    barber: 'itsrjstyles',
    guest_name: 'TEST Demo',
    guest_phone: '4155550100',
    guest_email: null,
    notes: null,
    start_ts: 1_000_000,
    end_ts: 1_001_800,
    ...over,
  };
}

describe('insertBookingIfFree (atomic double-booking prevention)', () => {
  it('inserts the first booking for a free slot', async () => {
    const d = db();
    expect(await insertBookingIfFree(d, booking())).toBe(true);
  });

  it('rejects an overlapping second booking for the same barber', async () => {
    const d = db();
    expect(await insertBookingIfFree(d, booking())).toBe(true);
    // Same window
    expect(await insertBookingIfFree(d, booking({ id: 'CSH-TEST02' }))).toBe(false);
    // Partial overlap (starts inside the first booking)
    expect(await insertBookingIfFree(d, booking({ id: 'CSH-TEST03', start_ts: 900_000, end_ts: 1_000_100 }))).toBe(false);
    // Partial overlap (ends inside the first booking)
    expect(await insertBookingIfFree(d, booking({ id: 'CSH-TEST04', start_ts: 1_001_700, end_ts: 1_100_000 }))).toBe(false);
    // Enclosing window
    expect(await insertBookingIfFree(d, booking({ id: 'CSH-TEST05', start_ts: 900_000, end_ts: 1_100_000 }))).toBe(false);
  });

  it('allows back-to-back bookings (end == start is not an overlap)', async () => {
    const d = db();
    expect(await insertBookingIfFree(d, booking())).toBe(true);
    expect(
      await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', start_ts: 1_001_800, end_ts: 1_003_600 })),
    ).toBe(true);
  });

  it('is a single SQL statement (no check-then-insert race window)', async () => {
    const d = new D1Shim();
    d.prepares = 0; // ignore the constructor's seed-row prepares
    await insertBookingIfFree(d as unknown as D1Database, booking());
    expect(d.prepares).toBe(1);
  });
});

describe('rescheduleBooking (atomic move)', () => {
  it('moves a booking to a free window', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'itsrjstyles', 2_000_000, 2_001_800)).toBe(true);
  });

  it('refuses a move into a window taken by another booking', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', start_ts: 2_000_000, end_ts: 2_001_800 }));
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'itsrjstyles', 2_000_000, 2_001_800)).toBe(false);
  });

  it('refuses to move a cancelled booking', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await (d as unknown as { prepare: D1Shim['prepare'] })
      .prepare("UPDATE bookings SET status = 'cancelled' WHERE id = 'CSH-TEST01'")
      .bind()
      .run();
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'itsrjstyles', 2_000_000, 2_001_800)).toBe(false);
  });
});

describe('listBusyRangesExcluding', () => {
  it('excludes the named booking (used for reschedule slot generation)', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', start_ts: 2_000_000, end_ts: 2_001_800 }));
    const busy = await listBusyRangesExcluding(d, 0, 9_999_999, 'CSH-TEST01');
    expect(busy).toHaveLength(1);
    expect(busy[0].start_ts).toBe(2_000_000);
  });
});

describe('admin config writes', () => {
  it('updateService changes duration, price, and active flag', async () => {
    const d = db();
    await updateService(d, 'svc1', { duration_minutes: 45, price_cents: null, is_active: 0 });
    const row = (d as unknown as D1Shim)
      .prepare('SELECT duration_minutes, price_cents, is_active FROM services WHERE id = ?1')
      .bind('svc1')
      .first<{ duration_minutes: number; price_cents: number | null; is_active: number }>();
    expect(row).toMatchObject({ duration_minutes: 45, price_cents: null, is_active: 0 });
  });

  it('updateShopHours changes open/close/closed for one weekday', async () => {
    const d = db();
    await updateShopHours(d, 1, { open_time: '10:00', close_time: '16:00', is_closed: 1 });
    const row = (d as unknown as D1Shim)
      .prepare('SELECT open_time, close_time, is_closed FROM shop_hours WHERE day_of_week = ?1')
      .bind(1)
      .first<{ open_time: string; close_time: string; is_closed: number }>();
    expect(row).toMatchObject({ open_time: '10:00', close_time: '16:00', is_closed: 1 });
  });
});
