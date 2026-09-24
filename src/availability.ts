// Timezone-aware slot generation for the demo shop.
// Cloudflare Workers run with UTC as the process timezone, so all owner-day
// math goes through Intl with the shop's IANA timezone (America/Los_Angeles).
// Pattern follows the edge-cal reference architecture.

import {
  BOOKING_DAYS_AHEAD,
  MIN_LEAD_MINUTES,
  SHOP_TZ,
  SLOT_STRIDE_MINUTES,
  type ShopHours,
  type Slot,
} from './types';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  weekday: number; // 0 = Sunday
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** UTC instant -> wall-clock fields as seen in the shop timezone. */
export function zonedParts(ts: number): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(new Date(ts))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/**
 * Wall-clock time in the shop timezone -> UTC epoch ms.
 * Iteratively converges on the offset (handles DST boundaries);
 * nonexistent spring-forward times resolve to a nearby real instant.
 */
export function wallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(guess);
    const targetMin = day * 24 * 60 + hour * 60 + minute;
    const actualMin = p.day * 24 * 60 + p.hour * 60 + p.minute;
    const diffMin = targetMin - actualMin;
    if (diffMin === 0) break;
    guess += diffMin * 60 * 1000;
  }
  return guess;
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

const timeLabelFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TZ,
  hour: 'numeric',
  minute: '2-digit',
});

const dateLabelFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TZ,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "2026-09-25" -> {year, month, day}; rejects impossible dates (e.g. 2026-02-30). */
function parseDateStr(dateStr: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null; // e.g. Feb 30 — JS Date would silently roll into March
  }
  return { year, month, day };
}

export interface BusyRange {
  start_ts: number;
  end_ts: number;
}

function overlaps(aStart: number, aEnd: number, busy: BusyRange[]): boolean {
  return busy.some((b) => aStart < b.end_ts && aEnd > b.start_ts);
}

/**
 * Generate bookable slots for one date (YYYY-MM-DD in shop tz).
 * A slot is valid when it fits inside shop hours, starts after the minimum
 * lead time, is within the booking window, and doesn't overlap a booking.
 */
export function generateSlotsForDate(
  dateStr: string,
  hours: ShopHours[],
  durationMinutes: number,
  busy: BusyRange[],
  nowTs: number,
): Slot[] {
  const d = parseDateStr(dateStr);
  if (!d) return [];

  const dayStartUtc = wallToUtc(d.year, d.month, d.day, 0, 0);
  const weekday = zonedParts(dayStartUtc).weekday;
  const rule = hours.find((h) => h.day_of_week === weekday);
  if (!rule || rule.is_closed) return [];

  const { h: openH, m: openM } = parseTime(rule.open_time);
  const { h: closeH, m: closeM } = parseTime(rule.close_time);
  const openUtc = wallToUtc(d.year, d.month, d.day, openH, openM);
  const closeUtc = wallToUtc(d.year, d.month, d.day, closeH, closeM);
  if (closeUtc <= openUtc) return [];

  const leadCutoff = nowTs + MIN_LEAD_MINUTES * 60 * 1000;
  const windowEnd = nowTs + BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  const strideMs = SLOT_STRIDE_MINUTES * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;

  const slots: Slot[] = [];
  for (let start = openUtc; start + durationMs <= closeUtc; start += strideMs) {
    const end = start + durationMs;
    if (start < leadCutoff) continue;
    if (start > windowEnd) continue;
    if (overlaps(start, end, busy)) continue;
    slots.push({
      startTs: start,
      endTs: end,
      startLabel: timeLabelFmt.format(new Date(start)),
      endLabel: timeLabelFmt.format(new Date(end)),
      dateLabel: dateLabelFmt.format(new Date(start)),
    });
  }
  return slots;
}

/** Next N bookable dates (YYYY-MM-DD in shop tz) that aren't fully closed. */
export function nextBookableDates(hours: ShopHours[], nowTs: number, count = BOOKING_DAYS_AHEAD): string[] {
  const today = zonedParts(nowTs);
  const dates: string[] = [];
  for (let i = 0; dates.length < count && i < count + 7; i++) {
    // Normalize through a real Date first: wallToUtc's iterative solver
    // compares day-of-month, so passing an un-normalized day (e.g. Sep 35)
    // would diverge. Normalizing here keeps month boundaries exact.
    const probe = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12, 0));
    const noon = wallToUtc(
      probe.getUTCFullYear(),
      probe.getUTCMonth() + 1,
      probe.getUTCDate(),
      12,
      0,
    );
    const p = zonedParts(noon);
    const weekday = p.weekday;
    const rule = hours.find((h) => h.day_of_week === weekday);
    if (rule && !rule.is_closed) {
      const y = String(p.year).padStart(4, '0');
      const mo = String(p.month).padStart(2, '0');
      const da = String(p.day).padStart(2, '0');
      dates.push(`${y}-${mo}-${da}`);
    }
  }
  return dates;
}

/** True when dateStr is a real calendar date within the booking window. */
export function isDateInWindow(dateStr: string, nowTs: number): boolean {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const dayStart = wallToUtc(d.year, d.month, d.day, 0, 0);
  const todayStart = wallToUtc(...dateTuple(zonedParts(nowTs)), 0, 0);
  const maxStart = todayStart + BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  return dayStart >= todayStart && dayStart <= maxStart;
}

function dateTuple(p: ZonedParts): [number, number, number] {
  return [p.year, p.month, p.day];
}
