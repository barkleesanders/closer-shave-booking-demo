// Shared types and constants for the Closer Shave booking demo.

export interface Bindings {
  DB: D1Database;
  ADMIN_KEY?: string;      // wrangler secret — demo-grade admin gate
  RESEND_API_KEY?: string; // wrangler secret — live email when set
  EMAIL_FROM?: string;     // wrangler var
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  price_note: string | null;
  barber_id: string | null;
  is_active: number;
  sort_order: number;
}

/** One barber's profile, from the barbers table. */
export interface Barber {
  id: string;            // stable slug: 'jesse', 'temur', 'juan', 'rj'
  name: string;
  photo_url: string;
  booksy_url: string;
  phone: string | null;
  rating: number;
  review_count: number;
  notes: string | null;
  is_active: number;
  sort_order: number;
}

/**
 * One open window on a weekday for a barber: { day_of_week: 0 = Sunday,
 * open_time/close_time: "HH:MM" wall clock in SHOP_TZ }.
 * A weekday with no windows is closed; multiple windows on one day are a
 * split shift (e.g. Juan's Monday 12:00–17:15 + 17:45–21:00).
 */
export interface DayWindow {
  day_of_week: number;
  open_time: string;
  close_time: string;
}

/** Canonical barber ids, seeded by seeds/barbers.sql. */
export const BARBER_IDS = ['jesse', 'temur', 'juan', 'rj'] as const;

export interface ShopHours {
  day_of_week: number; // 0 = Sunday
  open_time: string;   // "09:00"
  close_time: string;  // "18:00"
  is_closed: number;
}

export interface Booking {
  id: string;
  service_id: string;
  barber: string;          // legacy display slug; kept populated, equals barber_id
  barber_id: string | null; // FK -> barbers(id); canonical barber reference
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  notes: string | null;
  start_ts: number;
  end_ts: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  confirmation_sent: number;
  reminder_sent: number;
  created_at: number;
}

export interface Slot {
  startTs: number;       // epoch ms UTC
  endTs: number;         // epoch ms UTC
  startLabel: string;    // "9:00 AM" in shop tz
  endLabel: string;      // "9:30 AM"
  dateLabel: string;     // "Thursday, September 25"
}

export const SHOP_TZ = 'America/Los_Angeles';
export const SHOP_NAME = 'The Closer Shave';
export const SHOP_ADDRESS = '411A Brannan St, San Francisco, CA 94107';
export const SHOP_PHONE = '415-465-5915';
export const SHOP_PHONE_LINK = '+14154655915';
export const BOOKING_DAYS_AHEAD = 14;
export const MIN_LEAD_MINUTES = 60;
export const SLOT_STRIDE_MINUTES = 15;
