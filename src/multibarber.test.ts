// Multi-barber tests against the canonical Booksy hours extracted 2026-09-24.
// Each barber's hours are encoded as DayWindow[] fixtures; closed days are
// simply absent. These tests lock the per-barber behavior the rebuild must keep.
import { describe, expect, it } from 'vitest';
import { generateSlotsForDate, nextBookableDates, wallToUtc } from './availability';
import { validateInput } from './routes/booking';
import { BARBER_IDS, type DayWindow } from './types';

const w = (dow: number, open: string, close: string): DayWindow => ({ day_of_week: dow, open_time: open, close_time: close });

// Canonical per-barber hours (Booksy, extracted 2026-09-24):
const JESSE: DayWindow[] = [w(2, '12:00', '19:00'), w(4, '10:00', '19:00'), w(6, '10:00', '15:00')];
const TEMUR: DayWindow[] = [w(2, '14:00', '19:00'), w(4, '14:00', '20:00'), w(6, '10:00', '15:30')];
const JUAN: DayWindow[] = [
  w(1, '12:00', '17:15'),
  w(1, '17:45', '21:00'),
  w(3, '15:00', '21:00'),
  w(5, '12:00', '18:00'),
];
const RJ: DayWindow[] = [w(0, '12:00', '17:00'), w(2, '12:00', '20:00'), w(4, '12:00', '20:30')];

const NOON_THU = wallToUtc(2026, 9, 24, 12, 0);
const SUN_NOON = wallToUtc(2026, 9, 27, 12, 0); // Sunday before the Juan-split test Monday

describe('all four barbers exist and validate', () => {
  it('BARBER_IDS has exactly the four canonical barbers', () => {
    expect(BARBER_IDS).toEqual(['jesse', 'temur', 'juan', 'rj']);
  });

  it('validateInput accepts each canonical barber', () => {
    for (const b of BARBER_IDS) {
      const raw = {
        service: 'haircut', barber: b, date: '2026-09-29',
        slotStart: String(wallToUtc(2026, 9, 29, 13, 0)),
        name: 'X', phone: '(415) 555-0100',
      };
      const { errors } = validateInput(raw, BARBER_IDS);
      expect(errors.map((e) => e.field)).not.toContain('barber');
    }
  });
});

describe('per-barber bookable dates', () => {
  it('Jesse: Tue/Thu/Sat only', () => {
    const dates = nextBookableDates(JESSE, NOON_THU, 8);
    expect(dates).toContain('2026-09-24'); // Thu
    expect(dates).toContain('2026-09-26'); // Sat
    expect(dates).toContain('2026-09-29'); // Tue
    expect(dates).not.toContain('2026-09-25'); // Fri closed
    expect(dates).not.toContain('2026-09-27'); // Sun closed
    expect(dates).not.toContain('2026-09-28'); // Mon closed
  });

  it('Juan: Mon/Wed/Fri only', () => {
    const dates = nextBookableDates(JUAN, NOON_THU, 8);
    expect(dates).toContain('2026-09-25'); // Fri
    expect(dates).toContain('2026-09-28'); // Mon
    expect(dates).toContain('2026-09-30'); // Wed
    expect(dates).not.toContain('2026-09-24'); // Thu closed
    expect(dates).not.toContain('2026-09-26'); // Sat closed
  });

  it('RJ: Sun/Tue/Thu only', () => {
    const dates = nextBookableDates(RJ, NOON_THU, 8);
    expect(dates).toContain('2026-09-24'); // Thu
    expect(dates).toContain('2026-09-27'); // Sun
    expect(dates).toContain('2026-09-29'); // Tue
    expect(dates).not.toContain('2026-09-25'); // Fri closed
  });
});

describe('closed-day behavior', () => {
  it('no slots on closed days', () => {
    expect(generateSlotsForDate('2026-09-27', JESSE, 45, [], SUN_NOON)).toEqual([]); // Jesse Sun closed
    expect(generateSlotsForDate('2026-09-28', JUAN, 45, [], SUN_NOON)).not.toEqual([]); // Juan Mon OPEN
    expect(generateSlotsForDate('2026-09-28', TEMUR, 45, [], SUN_NOON)).toEqual([]); // Temur Mon closed
    expect(generateSlotsForDate('2026-09-26', JUAN, 45, [], SUN_NOON)).toEqual([]); // Juan Sat closed
  });
});

describe('Juan Monday split shift (12:00–17:15, 17:45–21:00)', () => {
  it('keeps the 17:15–17:45 gap free of slot starts', () => {
    // Monday 2026-09-28, 45-min service, evaluated from Sunday noon (no lead-time)
    const slots = generateSlotsForDate('2026-09-28', JUAN, 45, [], SUN_NOON);
    const labels = slots.map((s) => s.startLabel);
    expect(labels.length).toBeGreaterThan(0);
    // Last slot of the first window: 16:30 + 45m = 17:15 exactly
    expect(labels).toContain('4:30 PM');
    expect(labels).not.toContain('4:45 PM');
    // Nothing may start in the 17:15–17:45 gap
    expect(labels).not.toContain('5:15 PM');
    expect(labels).not.toContain('5:30 PM');
    // Second window resumes at 17:45; a 45-min slot starting 5:45 PM ends 6:30 PM
    expect(labels).toContain('5:45 PM');
  });

  it('has two Monday windows (a split day is not truncated to one)', () => {
    const slots = generateSlotsForDate('2026-09-28', JUAN, 30, [], SUN_NOON);
    const labels = slots.map((s) => s.startLabel);
    expect(labels).toContain('12:00 PM');
    expect(labels).toContain('8:30 PM'); // last 30-min start in the 17:45–21:00 window
  });
});

describe('per-barber hours shape', () => {
  it('Temur Saturday runs 10:00–15:30 (last 45-min start 2:45 PM)', () => {
    const slots = generateSlotsForDate('2026-09-26', TEMUR, 45, [], NOON_THU);
    const labels = slots.map((s) => s.startLabel);
    expect(labels[0]).toBe('10:00 AM');
    expect(labels[labels.length - 1]).toBe('2:45 PM');
  });

  it('Jesse Saturday closes at 15:00 (last 45-min start 2:15 PM)', () => {
    const slots = generateSlotsForDate('2026-09-26', JESSE, 45, [], NOON_THU);
    const labels = slots.map((s) => s.startLabel);
    expect(labels[labels.length - 1]).toBe('2:15 PM');
  });

  it('RJ Sunday has slots, Jesse Sunday has none', () => {
    expect(generateSlotsForDate('2026-09-27', RJ, 30, [], SUN_NOON).length).toBeGreaterThan(0);
    expect(generateSlotsForDate('2026-09-27', JESSE, 30, [], SUN_NOON)).toEqual([]);
  });
});
