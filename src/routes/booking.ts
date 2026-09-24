// Public booking routes: page, slot API, booking submission, confirmation.
import { Hono } from 'hono';
import {
  generateSlotsForDate,
  isDateInWindow,
  localDayBounds,
  nextBookableDates,
} from '../availability';
import {
  getBooking,
  getServiceBySlug,
  insertBookingIfFree,
  listBookingsInRange,
  listBusyRangesExcluding,
  listServices,
  listShopHours,
  rescheduleBooking,
} from '../db';
import { sendConfirmationEmail } from '../email';
import { bookingPage, cancelledPage, confirmationPage, errorPage } from '../templates/pages';
import type { Bindings, Service } from '../types';

export const ALLOWED_BARBERS = ['itsrjstyles'];

export interface BookingInput {
  serviceSlug: string;
  barber: string;
  date: string;
  slotStart: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Pure validation of raw form fields (no DB). Testable without D1. */
export function validateInput(raw: Record<string, string>): { input: BookingInput; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const input: BookingInput = {
    serviceSlug: (raw.service ?? '').trim(),
    barber: (raw.barber ?? '').trim(),
    date: (raw.date ?? '').trim(),
    slotStart: Number(raw.slotStart),
    name: (raw.name ?? '').trim().slice(0, 80),
    phone: (raw.phone ?? '').trim(),
    email: (raw.email ?? '').trim().slice(0, 120),
    notes: (raw.notes ?? '').trim().slice(0, 500),
  };
  if (!input.serviceSlug) errors.push({ field: 'service', message: 'Choose a service.' });
  if (!ALLOWED_BARBERS.includes(input.barber)) errors.push({ field: 'barber', message: 'Unknown barber.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push({ field: 'date', message: 'Pick a valid day.' });
  if (!Number.isFinite(input.slotStart) || input.slotStart <= 0)
    errors.push({ field: 'slotStart', message: 'Pick a time slot.' });
  if (input.name.length < 1) errors.push({ field: 'name', message: 'Enter your name.' });
  const digits = input.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15)
    errors.push({ field: 'phone', message: 'Enter a valid phone number.' });
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email))
    errors.push({ field: 'email', message: 'Enter a valid email address, or leave it blank.' });
  return { input, errors };
}

export function generateBookingId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `CSH-${s}`;
}

export function whenLabel(startTs: number, endTs: number): string {
  const date = new Date(startTs).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const t = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
  return `${date}, ${t(startTs)} – ${t(endTs)} PT`;
}

export const bookingRoutes = new Hono<{ Bindings: Bindings }>();

bookingRoutes.get('/', async (c) => {
  const [services, hours] = await Promise.all([listServices(c.env.DB), listShopHours(c.env.DB)]);
  const dates = nextBookableDates(hours, Date.now());
  return c.html(bookingPage(services, dates));
});

bookingRoutes.get('/api/slots', async (c) => {
  const serviceSlug = (c.req.query('service') ?? '').trim();
  const date = (c.req.query('date') ?? '').trim();
  const service: Service | null = await getServiceBySlug(c.env.DB, serviceSlug);
  if (!service) return c.json({ error: 'Unknown service.' }, 400);
  if (!isDateInWindow(date, Date.now())) return c.json({ error: 'Date out of range.' }, 400);

  const bounds = localDayBounds(date);
  if (!bounds) return c.json({ error: 'Invalid date.' }, 400);
  const busy = await listBookingsInRange(c.env.DB, bounds.start, bounds.end);
  const hours = await listShopHours(c.env.DB);
  const slots = generateSlotsForDate(date, hours, service.duration_minutes, busy, Date.now());
  return c.json({ slots });
});

bookingRoutes.post('/api/book', async (c) => {
  const form = await c.req.parseBody();
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) raw[k] = typeof v === 'string' ? v : '';

  const { input, errors } = validateInput(raw);
  const [services, hours] = await Promise.all([listServices(c.env.DB), listShopHours(c.env.DB)]);
  const dates = nextBookableDates(hours, Date.now());
  if (errors.length) {
    return c.html(bookingPage(services, dates, errors[0].message), 400);
  }

  const service = await getServiceBySlug(c.env.DB, input.serviceSlug);
  if (!service) return c.html(bookingPage(services, dates, 'Unknown service.'), 400);
  if (!isDateInWindow(input.date, Date.now()))
    return c.html(bookingPage(services, dates, 'That day is no longer bookable.'), 400);

  // Server-side slot revalidation: the chosen instant must be a genuinely
  // valid slot (never trust the client).
  const bounds = localDayBounds(input.date);
  if (!bounds) return c.html(bookingPage(services, dates, 'Invalid date.'), 400);
  const busy = await listBookingsInRange(c.env.DB, bounds.start, bounds.end);
  const validStarts = new Set(
    generateSlotsForDate(input.date, hours, service.duration_minutes, busy, Date.now()).map((s) => s.startTs),
  );
  if (!validStarts.has(input.slotStart)) {
    return c.html(bookingPage(services, dates, 'That time was just taken or is no longer valid — pick another.'), 409);
  }

  const startTs = input.slotStart;
  const endTs = startTs + service.duration_minutes * 60 * 1000;

  // Atomic insert: one SQL statement succeeds only when no confirmed booking
  // for the barber overlaps the window — two concurrent POSTs for the same
  // slot cannot both win. (The 409 above is the friendly early check.)
  let bookingId = '';
  let booked = false;
  let insertErrored = false;
  for (let attempt = 0; attempt < 3 && !booked; attempt++) {
    bookingId = generateBookingId();
    try {
      booked = await insertBookingIfFree(c.env.DB, {
        id: bookingId,
        service_id: service.id,
        barber: input.barber,
        guest_name: input.name,
        guest_phone: input.phone,
        guest_email: input.email || null,
        notes: input.notes || null,
        start_ts: startTs,
        end_ts: endTs,
      });
    } catch (err) {
      // Almost certainly a rare booking-ID collision — retry with a fresh ID.
      insertErrored = true;
      console.error(JSON.stringify({ msg: 'booking_insert_failed', attempt, err: String(err).slice(0, 200) }));
    }
  }
  if (!booked && insertErrored) {
    return c.html(errorPage('Booking failed', 'Could not save your booking. Please try again.'), 500);
  }
  if (!booked) {
    return c.html(bookingPage(services, dates, 'That time was just taken — pick another.'), 409);
  }

  // Confirmation email: best effort — a failed send must not fail the booking.
  const booking = await getBooking(c.env.DB, bookingId);
  if (booking?.guest_email) {
    try {
      const result = await sendConfirmationEmail(c.env, booking, service.name, whenLabel(startTs, endTs));
      if (result.sent) {
        const { markConfirmationSent } = await import('../db');
        await markConfirmationSent(c.env.DB, bookingId);
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'confirmation_email_error', id: bookingId, err: String(err).slice(0, 200) }));
    }
  }

  return c.redirect(`/book/${bookingId}`, 303);
});

bookingRoutes.get('/book/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^CSH-[A-Z0-9]{6}$/.test(id)) return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  const booking = await getBooking(c.env.DB, id);
  if (!booking || booking.status === 'cancelled')
    return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  const [services, hours] = await Promise.all([listServices(c.env.DB), listShopHours(c.env.DB)]);
  const service = services.find((s) => s.id === booking.service_id);
  const serviceName = service?.name ?? 'Appointment';
  const serviceSlug = service?.slug ?? '';
  const dates = nextBookableDates(hours, Date.now());
  const emailNote = booking.confirmation_sent
    ? 'A confirmation email was sent.'
    : booking.guest_email
      ? 'Email is in demo mode (no mail key configured), so no confirmation email was sent.'
      : 'No email address was provided, so no confirmation email was sent.';
  return c.html(confirmationPage(booking, serviceName, serviceSlug, dates, whenLabel(booking.start_ts, booking.end_ts), emailNote));
});

/** Move a confirmed booking to a new day/time. Atomic single-statement move. */
bookingRoutes.post('/book/:id/reschedule', async (c) => {
  const id = c.req.param('id');
  if (!/^CSH-[A-Z0-9]{6}$/.test(id)) return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  const booking = await getBooking(c.env.DB, id);
  if (!booking || booking.status === 'cancelled')
    return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);

  const form = await c.req.parseBody();
  const date = typeof form.date === 'string' ? form.date.trim() : '';
  const slotStart = Number(form.slotStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isDateInWindow(date, Date.now()))
    return c.html(errorPage('Reschedule failed', 'Pick a valid day within the next 14 days.'), 400);
  if (!Number.isFinite(slotStart) || slotStart <= 0)
    return c.html(errorPage('Reschedule failed', 'Pick a time slot.'), 400);

  const [services, hours] = await Promise.all([listServices(c.env.DB), listShopHours(c.env.DB)]);
  const service = services.find((s) => s.id === booking.service_id);
  if (!service) return c.html(errorPage('Reschedule failed', 'Unknown service.'), 400);

  // Valid slots for the day, excluding this booking's own current window.
  const bounds = localDayBounds(date);
  if (!bounds) return c.html(errorPage('Reschedule failed', 'Invalid date.'), 400);
  const busy = await listBusyRangesExcluding(c.env.DB, bounds.start, bounds.end, id);
  const validStarts = new Set(
    generateSlotsForDate(date, hours, service.duration_minutes, busy, Date.now()).map((s) => s.startTs),
  );
  if (!validStarts.has(slotStart)) {
    return c.html(errorPage('Reschedule failed', 'That time was just taken or is no longer valid — pick another.'), 409);
  }

  const endTs = slotStart + service.duration_minutes * 60 * 1000;
  const moved = await rescheduleBooking(c.env.DB, id, booking.barber, slotStart, endTs);
  if (!moved) {
    return c.html(errorPage('Reschedule failed', 'That time was just taken — pick another.'), 409);
  }
  console.log(JSON.stringify({ msg: 'booking_rescheduled', id, slotStart }));
  return c.redirect(`/book/${id}`, 303);
});

/** Cancel a confirmed booking from its confirmation page. */
bookingRoutes.post('/book/:id/cancel', async (c) => {
  const id = c.req.param('id');
  if (!/^CSH-[A-Z0-9]{6}$/.test(id)) return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  const { cancelBooking } = await import('../db');
  const ok = await cancelBooking(c.env.DB, id);
  if (!ok) return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  console.log(JSON.stringify({ msg: 'booking_cancelled', id }));
  return c.html(cancelledPage(id));
});
