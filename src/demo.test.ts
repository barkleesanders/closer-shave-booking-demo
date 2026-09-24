// Tests for the demo's pure logic: availability math, input validation,
// and the email demo-mode seam. No D1/KV mocks needed.
import { describe, expect, it } from 'vitest';
import {
  generateSlotsForDate,
  isDateInWindow,
  localDayBounds,
  nextBookableDates,
  shopHoursToWindows,
  wallToUtc,
  zonedParts,
} from './availability';
import { emailEnabled, sendConfirmationEmail } from './email';
import { generateBookingId, validateInput } from './routes/booking';
import { BARBER_IDS, type Bindings, type Booking, type ShopHours } from './types';

// Real canonical hours (Booksy shop listing 1150636, fetched 2026-09-24):
// Sun 11:00-18:00, Mon closed, Tue 14:00-18:00, Wed 11:00-19:30,
// Thu 14:00-20:00, Fri 10:30-20:00, Sat 11:00-18:00.
const HOURS: ShopHours[] = [
  { day_of_week: 0, open_time: '11:00', close_time: '18:00', is_closed: 0 },
  { day_of_week: 1, open_time: '11:00', close_time: '18:00', is_closed: 1 },
  { day_of_week: 2, open_time: '14:00', close_time: '18:00', is_closed: 0 },
  { day_of_week: 3, open_time: '11:00', close_time: '19:30', is_closed: 0 },
  { day_of_week: 4, open_time: '14:00', close_time: '20:00', is_closed: 0 },
  { day_of_week: 5, open_time: '10:30', close_time: '20:00', is_closed: 0 },
  { day_of_week: 6, open_time: '11:00', close_time: '18:00', is_closed: 0 },
];
const WIN = shopHoursToWindows(HOURS);

// Thursday 2026-09-24 12:00 PT (shop tz)
const NOON_THU = wallToUtc(2026, 9, 24, 12, 0);

describe('zoned time helpers', () => {
  it('round-trips wall clock through UTC in the shop timezone', () => {
    const ts = wallToUtc(2026, 9, 25, 9, 30);
    const p = zonedParts(ts);
    expect(p).toMatchObject({ year: 2026, month: 9, day: 25, hour: 9, minute: 30, weekday: 5 });
  });

  it('handles a DST-boundary date without throwing', () => {
    // 2026-11-01 is the fall-back Sunday; 09:00 PT must still resolve to 09:00 PT
    const ts = wallToUtc(2026, 11, 1, 9, 0);
    expect(zonedParts(ts)).toMatchObject({ month: 11, day: 1, hour: 9 });
  });

  it('resolves the 1st of a month to the right month (not the prior month)', () => {
    // Regression: the old day-of-month-only convergence landed 2026-10-01 on
    // 2026-09-01, making every 1st-of-month unbookable.
    for (const [y, m] of [[2026, 10], [2026, 11], [2026, 12], [2027, 1]] as const) {
      const ts = wallToUtc(y, m, 1, 9, 30);
      expect(zonedParts(ts)).toMatchObject({ year: y, month: m, day: 1, hour: 9, minute: 30 });
    }
    expect(isDateInWindow('2026-10-01', NOON_THU)).toBe(true);
  });

  it('localDayBounds covers a shop-local day, not a UTC day', () => {
    // 2026-09-25 19:00 PT = 2026-09-26 02:00 UTC — a UTC-midnight window for
    // 2026-09-25 would miss it; the shop-local window must contain it.
    const bounds = localDayBounds('2026-09-25');
    expect(bounds).not.toBeNull();
    const evening = wallToUtc(2026, 9, 25, 19, 0);
    expect(evening).toBeGreaterThanOrEqual(bounds!.start);
    expect(evening).toBeLessThan(bounds!.end);
    // Exactly 24h wide, start is local midnight
    expect(bounds!.end - bounds!.start).toBe(24 * 60 * 60 * 1000);
    expect(zonedParts(bounds!.start)).toMatchObject({ month: 9, day: 25, hour: 0, minute: 0 });
    expect(localDayBounds('2026-02-30')).toBeNull();
  });
});

describe('generateSlotsForDate', () => {
  it('generates 15-min-stride slots inside open hours, after the lead time', () => {
    // Friday 2026-09-25, open 10:30–20:00, 30-min service, now = Thu noon
    const slots = generateSlotsForDate('2026-09-25', WIN, 30, [], NOON_THU);
    expect(slots.length).toBe(37); // 10:30 AM → 7:30 PM every 15 min
    expect(slots[0].startLabel).toBe('10:30 AM');
    expect(slots[slots.length - 1].startLabel).toBe('7:30 PM');
    expect(slots[0].dateLabel).toContain('September 25');
  });

  it('excludes slots inside the 60-minute lead time on the current day', () => {
    // Thursday 2026-09-24, now = noon PT, shop opens 2:00 PM → first slot 2:00 PM
    const slots = generateSlotsForDate('2026-09-24', WIN, 30, [], NOON_THU);
    expect(slots.length).toBe(23); // 2:00 PM → 7:30 PM
    expect(slots[0].startLabel).toBe('2:00 PM');
  });

  it('returns no slots on closed days, slots on open Sundays', () => {
    expect(generateSlotsForDate('2026-09-28', WIN, 30, [], NOON_THU)).toEqual([]); // Monday closed
    expect(generateSlotsForDate('2026-09-27', WIN, 30, [], NOON_THU).length).toBeGreaterThan(0); // Sunday open
  });

  it('fits long services against a half-hour close', () => {
    // Wednesday 2026-09-30, open 11:00–19:30, 90-min service → last start 6:00 PM
    const now = wallToUtc(2026, 9, 29, 12, 0);
    const slots = generateSlotsForDate('2026-09-30', WIN, 90, [], now);
    expect(slots.length).toBe(29); // 11:00 AM → 6:00 PM every 15 min
    expect(slots[0].startLabel).toBe('11:00 AM');
    expect(slots[slots.length - 1].startLabel).toBe('6:00 PM');
  });

  it('rejects impossible calendar dates', () => {
    expect(generateSlotsForDate('2026-02-30', WIN, 30, [], NOON_THU)).toEqual([]);
    expect(isDateInWindow('2026-02-30', NOON_THU)).toBe(false);
  });

  it('excludes slots overlapping an existing booking', () => {
    const busy = [{ start_ts: wallToUtc(2026, 9, 25, 11, 0), end_ts: wallToUtc(2026, 9, 25, 11, 30) }];
    const slots = generateSlotsForDate('2026-09-25', WIN, 30, busy, NOON_THU);
    const labels = slots.map((s) => s.startLabel);
    // A 30-min service overlapping 11:00–11:30 blocks starts 10:45, 11:00, 11:15
    expect(labels).not.toContain('10:45 AM');
    expect(labels).not.toContain('11:00 AM');
    expect(labels).not.toContain('11:15 AM');
    expect(labels).toContain('10:30 AM');
    expect(labels).toContain('11:30 AM');
  });

  it('rejects malformed dates', () => {
    expect(generateSlotsForDate('not-a-date', WIN, 30, [], NOON_THU)).toEqual([]);
  });
});

describe('nextBookableDates', () => {
  it('starts today and skips closed days', () => {
    const dates = nextBookableDates(WIN, NOON_THU, 5);
    expect(dates[0]).toBe('2026-09-24'); // Thursday
    expect(dates).toContain('2026-09-25'); // Friday
    expect(dates).toContain('2026-09-26'); // Saturday
    expect(dates).toContain('2026-09-27'); // Sunday open
    expect(dates).not.toContain('2026-09-28'); // Monday closed
    expect(dates).toContain('2026-09-29'); // Tuesday
  });

  it('crosses a month boundary without diverging', () => {
    // Wednesday 2026-09-30 noon PT; all days open 09:00–18:00
    const allOpen: ShopHours[] = [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      day_of_week,
      open_time: '09:00',
      close_time: '18:00',
      is_closed: 0,
    }));
    const now = wallToUtc(2026, 9, 30, 12, 0);
    const dates = nextBookableDates(shopHoursToWindows(allOpen), now, 5);
    expect(dates).toEqual([
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });
});

describe('isDateInWindow', () => {
  it('accepts today through +14 days, rejects outside', () => {
    expect(isDateInWindow('2026-09-24', NOON_THU)).toBe(true);
    expect(isDateInWindow('2026-10-08', NOON_THU)).toBe(true); // +14
    expect(isDateInWindow('2026-09-23', NOON_THU)).toBe(false); // yesterday
    expect(isDateInWindow('2026-10-09', NOON_THU)).toBe(false); // +15
    expect(isDateInWindow('garbage', NOON_THU)).toBe(false);
  });
});

describe('validateInput', () => {
  const good = {
    service: 'haircut',
    barber: 'rj',
    date: '2026-09-25',
    slotStart: String(wallToUtc(2026, 9, 25, 10, 0)),
    name: 'Test User',
    phone: '(415) 555-0100',
    email: 'test@example.com',
    notes: 'hi',
  };

  it('accepts a complete valid submission', () => {
    const { input, errors } = validateInput(good, BARBER_IDS);
    expect(errors).toEqual([]);
    expect(input.name).toBe('Test User');
  });

  it('accepts a submission without email', () => {
    const { errors } = validateInput({ ...good, email: '' }, BARBER_IDS);
    expect(errors).toEqual([]);
  });

  it('rejects missing service, unknown barber, bad phone, bad email, no slot', () => {
    const { errors } = validateInput({
      service: '',
      barber: 'someone-else',
      date: '2026-09-25',
      slotStart: '0',
      name: '',
      phone: '123',
      email: 'not-an-email',
      notes: '',
    }, BARBER_IDS);
    const fields = errors.map((e) => e.field);
    expect(fields).toContain('service');
    expect(fields).toContain('barber');
    expect(fields).toContain('slotStart');
    expect(fields).toContain('name');
    expect(fields).toContain('phone');
    expect(fields).toContain('email');
  });

  it('rejects malformed dates', () => {
    const { errors } = validateInput({ ...good, date: '09/25/2026' }, BARBER_IDS);
    expect(errors.map((e) => e.field)).toContain('date');
  });
});

describe('generateBookingId', () => {
  it('produces CSH- prefixed, unambiguous IDs', () => {
    const ids = new Set(Array.from({ length: 200 }, generateBookingId));
    expect(ids.size).toBe(200); // no collisions in 200 draws
    for (const id of ids) expect(id).toMatch(/^CSH-[A-Z0-9]{6}$/);
  });
});

describe('email seam', () => {
  const booking = {
    id: 'CSH-ABC123',
    guest_name: 'Test User',
    guest_email: 'test@example.com',
    barber_id: 'rj',
  } as Booking;

  it('reports demo mode when no Resend key is configured', async () => {
    const env = {} as Bindings;
    expect(emailEnabled(env)).toBe(false);
    const r = await sendConfirmationEmail(env, booking, 'Haircut', 'Friday, September 25, 10:00 AM PT');
    expect(r.sent).toBe(false);
    expect(r.demoMode).toBe(true);
  });
});
