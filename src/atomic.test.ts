// Atomicity tests for the booking write path, executed against a REAL
// in-memory SQLite database (node:sqlite) with the production migration
// applied. D1 runs SQLite, so these statements behave identically there.
//
// The point under test: insertBookingIfFree and rescheduleBooking are each
// ONE SQL statement with a WHERE NOT EXISTS / NOT EXISTS guard, so SQLite
// executes them with no interleaving — two concurrent writers cannot both
// win the same slot. A mock would only test itself; this tests the real SQL.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  getServiceForBarber,
  insertBookingIfFree,
  listBusyRangesExcluding,
  rescheduleBooking,
  updateBarberHours,
  updateService,
  type NewBooking,
} from './db';

/** Minimal D1Database-compatible shim over node:sqlite. */
class D1Shim {
  #db: DatabaseSync;
  prepares = 0;

  constructor() {
    this.#db = new DatabaseSync(':memory:');
    const here = dirname(fileURLToPath(import.meta.url));
    const migDir = join(here, '..', 'migrations');
    for (const f of readdirSync(migDir).sort()) {
      if (f.endsWith('.sql')) this.#db.exec(readFileSync(join(migDir, f), 'utf8'));
    }
    // Minimal seed rows the tests need
    this.#db.exec(
      `INSERT OR IGNORE INTO barbers (id, name, photo_url, rating, review_count, phone, booksy_url, is_active, sort_order)
       VALUES
         ('jesse', 'Jesse Marquez', '', 5.0, 37, '(925) 517-5290', 'https://booksy.com/en-us/1714670_jesse_barber-shop_134715_san-francisco', 1, 1),
         ('temur', 'Temur Gold', '', 5.0, 125, '(415) 465-5915', 'https://booksy.com/en-us/575950_temurgoldclub-barbershop_barber-shop_134715_san-francisco', 1, 2);`,
    );
    this.#db.exec(
      `INSERT INTO services (id, barber_id, slug, name, duration_minutes, price_cents, is_active, sort_order)
       VALUES
         ('svc1', 'jesse', 'jesse-haircut', 'Haircut', 30, 7900, 1, 0),
         ('svc2', 'temur', 'temur-haircut', 'Haircut', 30, 8500, 1, 0);`,
    );
    this.#db.exec(
      `INSERT INTO barber_hours (barber_id, day_of_week, window_index, open_time, close_time)
       VALUES ('jesse', 2, 0, '12:00', '19:00'), ('temur', 2, 0, '14:00', '19:00');`,
    );
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

  // D1 batch(): run each bound statement in order, return their run() results.
  batch(stmts: Array<{ run: () => { meta: { changes: number } } }>) {
    return stmts.map((s) => s.run());
  }
}

function db() {
  return new D1Shim() as unknown as D1Database;
}

function booking(over: Partial<NewBooking> = {}): NewBooking {
  return {
    id: 'CSH-TEST01',
    service_id: 'svc1',
    barber_id: 'jesse',
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
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'jesse', 2_000_000, 2_001_800)).toBe(true);
  });

  it('refuses a move into a window taken by another booking', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', start_ts: 2_000_000, end_ts: 2_001_800 }));
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'jesse', 2_000_000, 2_001_800)).toBe(false);
  });

  it('refuses to move a cancelled booking', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await (d as unknown as { prepare: D1Shim['prepare'] })
      .prepare("UPDATE bookings SET status = 'cancelled' WHERE id = 'CSH-TEST01'")
      .bind()
      .run();
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'jesse', 2_000_000, 2_001_800)).toBe(false);
  });
});

describe('multi-barber isolation', () => {
  it('allows the same time slot for a different barber', async () => {
    const d = db();
    expect(await insertBookingIfFree(d, booking())).toBe(true); // jesse
    expect(
      await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', service_id: 'svc2', barber_id: 'temur' })),
    ).toBe(true); // same slot, other barber — no conflict
    expect(await insertBookingIfFree(d, booking({ id: 'CSH-TEST03' }))).toBe(false); // same slot, jesse — blocked
  });

  it('reschedule is scoped to the barber', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    // Another barber holds the target window; rescheduling jesse's booking there is fine
    await insertBookingIfFree(
      d,
      booking({ id: 'CSH-TEST02', service_id: 'svc2', barber_id: 'temur', start_ts: 2_000_000, end_ts: 2_001_800 }),
    );
    expect(await rescheduleBooking(d, 'CSH-TEST01', 'jesse', 2_000_000, 2_001_800)).toBe(true);
  });

  it('service lookup is scoped to the barber', async () => {
    const d = db();
    const jesseSvc = await getServiceForBarber(d, 'jesse', 'jesse-haircut');
    expect(jesseSvc?.price_cents).toBe(7900);
    // temur does not have a service with jesse's price; his haircut is distinct
    const temurSvc = await getServiceForBarber(d, 'temur', 'temur-haircut');
    expect(temurSvc?.price_cents).toBe(8500);
  });
});

describe('listBusyRangesExcluding', () => {
  it('excludes the named booking (used for reschedule slot generation)', async () => {
    const d = db();
    await insertBookingIfFree(d, booking());
    await insertBookingIfFree(d, booking({ id: 'CSH-TEST02', start_ts: 2_000_000, end_ts: 2_001_800 }));
    const busy = await listBusyRangesExcluding(d, 0, 9_999_999, 'CSH-TEST01', 'jesse');
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

  it('updateBarberHours replaces the windows for one barber weekday (split shift)', async () => {
    const d = db();
    await updateBarberHours(d, 'jesse', 1, [
      { open_time: '12:00', close_time: '17:15' },
      { open_time: '17:45', close_time: '21:00' },
    ]);
    const rows = (d as unknown as D1Shim)
      .prepare('SELECT open_time, close_time FROM barber_hours WHERE barber_id = ?1 AND day_of_week = ?2 ORDER BY window_index ASC')
      .bind('jesse', 1)
      .all<{ open_time: string; close_time: string }>().results;
    expect(rows).toEqual([
      { open_time: '12:00', close_time: '17:15' },
      { open_time: '17:45', close_time: '21:00' },
    ]);
    // Tuesday's window is untouched
    const tue = (d as unknown as D1Shim)
      .prepare('SELECT COUNT(*) AS n FROM barber_hours WHERE barber_id = ?1 AND day_of_week = ?2')
      .bind('jesse', 2)
      .first<{ n: number }>();
    expect(tue?.n).toBe(1);
  });
});
