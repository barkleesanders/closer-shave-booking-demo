// Public booking routes: page, slot API, booking submission, confirmation.
// Multi-barber: every availability/booking path is scoped to one barber.
import { Hono } from 'hono';
import {
  generateSlotsForDate,
  isDateInWindow,
  localDayBounds,
  nextBookableDates,
} from '../availability';
import {
  getBarberById,
  getBooking,
  getServiceForBarber,
  insertBookingIfFree,
  listAllBarberHours,
  listBarbers,
  listBarberHours,
  listBookingsInRange,
  listBusyRangesExcluding,
  listServicesForBarber,
  rescheduleBooking,
} from '../db';
import { sendConfirmationEmail } from '../email';
import { bookingPage, cancelledPage, confirmationPage, errorPage } from '../templates/pages';
import type { Bindings, Service } from '../types';

export interface BookingInput {
  serviceSlug: string;
  barberId: string;
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

/**
 * Pure validation of raw form fields (no DB). The caller passes the list of
 * active barber ids from the database; membership against it is the only
 * barber check here (routes re-verify the barber row itself).
 */
export function validateInput(
  raw: Record<string, string>,
  allowedBarbers: readonly string[],
): { input: BookingInput; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const input: BookingInput = {
    serviceSlug: (raw.service ?? '').trim(),
    barberId: (raw.barber ?? '').trim(),
    date: (raw.date ?? '').trim(),
    slotStart: Number(raw.slotStart),
    name: (raw.name ?? '').trim().slice(0, 80),
    phone: (raw.phone ?? '').trim(),
    email: (raw.email ?? '').trim().slice(0, 120),
    notes: (raw.notes ?? '').trim().slice(0, 500),
  };
  if (!input.serviceSlug) errors.push({ field: 'service', message: 'Choose a service.' });
  if (!allowedBarbers.includes(input.barberId))
    errors.push({ field: 'barber', message: 'Choose a barber.' });
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
  const [barbers, hoursMap] = await Promise.all([listBarbers(c.env.DB), listAllBarberHours(c.env.DB)]);
  const first = barbers[0];
  const services = first ? await listServicesForBarber(c.env.DB, first.id) : [];
  const dates = first ? nextBookableDates(hoursMap.get(first.id) ?? [], Date.now()) : [];
  return c.html(bookingPage(barbers, first?.id ?? '', services, dates, hoursMap));
});

/** JSON: active barbers (for the booking UI). */
bookingRoutes.get('/api/barbers', async (c) => {
  const barbers = await listBarbers(c.env.DB);
  return c.json({ barbers });
});

/** JSON: services for one barber. */
bookingRoutes.get('/api/services', async (c) => {
  const barberId = (c.req.query('barber') ?? '').trim();
  const barber = await getBarberById(c.env.DB, barberId);
  if (!barber) return c.json({ error: 'Unknown barber.' }, 400);
  const services = await listServicesForBarber(c.env.DB, barberId);
  return c.json({ services });
});

/** JSON: bookable dates for one barber (their hours, not shop hours). */
bookingRoutes.get('/api/dates', async (c) => {
  const barberId = (c.req.query('barber') ?? '').trim();
  const barber = await getBarberById(c.env.DB, barberId);
  if (!barber) return c.json({ error: 'Unknown barber.' }, 400);
  const hours = await listBarberHours(c.env.DB, barberId);
  return c.json({ dates: nextBookableDates(hours, Date.now()) });
});

bookingRoutes.get('/api/slots', async (c) => {
  const barberId = (c.req.query('barber') ?? '').trim();
  const serviceSlug = (c.req.query('service') ?? '').trim();
  const date = (c.req.query('date') ?? '').trim();
  const barber = await getBarberById(c.env.DB, barberId);
  if (!barber) return c.json({ error: 'Unknown barber.' }, 400);
  const service: Service | null = await getServiceForBarber(c.env.DB, barberId, serviceSlug);
  if (!service) return c.json({ error: 'Unknown service.' }, 400);
  if (!isDateInWindow(date, Date.now())) return c.json({ error: 'Date out of range.' }, 400);

  const bounds = localDayBounds(date);
  if (!bounds) return c.json({ error: 'Invalid date.' }, 400);
  const busy = await listBookingsInRange(c.env.DB, bounds.start, bounds.end, barberId);
  const hours = await listBarberHours(c.env.DB, barberId);
  const slots = generateSlotsForDate(date, hours, service.duration_minutes, busy, Date.now());
  return c.json({ slots });
});

bookingRoutes.post('/api/book', async (c) => {
  const form = await c.req.parseBody();
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) raw[k] = typeof v === 'string' ? v : '';

  const [barbers, hoursMap] = await Promise.all([listBarbers(c.env.DB), listAllBarberHours(c.env.DB)]);
  const barberIds = barbers.map((b) => b.id);
  const first = barbers[0];
  const repage = async (msg: string, status: 400 | 409) => {
    const services = first ? await listServicesForBarber(c.env.DB, first.id) : [];
    const dates = first ? nextBookableDates(hoursMap.get(first.id) ?? [], Date.now()) : [];
    return c.html(bookingPage(barbers, first?.id ?? '', services, dates, hoursMap, msg), status);
  };

  const { input, errors } = validateInput(raw, barberIds);
  if (errors.length) return repage(errors[0].message, 400);

  const barber = await getBarberById(c.env.DB, input.barberId);
  if (!barber) return repage('Unknown barber.', 400);
  const service = await getServiceForBarber(c.env.DB, input.barberId, input.serviceSlug);
  if (!service) return repage('Unknown service.', 400);
  if (!isDateInWindow(input.date, Date.now())) return repage('That day is no longer bookable.', 400);

  // Server-side slot revalidation: the chosen instant must be a genuinely
  // valid slot for THIS barber (never trust the client).
  const bounds = localDayBounds(input.date);
  if (!bounds) return repage('Invalid date.', 400);
  const busy = await listBookingsInRange(c.env.DB, bounds.start, bounds.end, input.barberId);
  const hours = await listBarberHours(c.env.DB, input.barberId);
  const validStarts = new Set(
    generateSlotsForDate(input.date, hours, service.duration_minutes, busy, Date.now()).map((s) => s.startTs),
  );
  if (!validStarts.has(input.slotStart)) {
    return repage('That time was just taken or is no longer valid — pick another.', 409);
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
        barber_id: input.barberId,
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
    return repage('That time was just taken — pick another.', 409);
  }

  // Confirmation email: best effort — a failed send must not fail the booking.
  const booking = await getBooking(c.env.DB, bookingId);
  if (booking?.guest_email) {
    try {
      const result = await sendConfirmationEmail(c.env, booking, service.name, whenLabel(startTs, endTs), barber.name);
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
  const [barbers, hoursMap] = await Promise.all([listBarbers(c.env.DB), listAllBarberHours(c.env.DB)]);
  const barber = booking.barber_id ? await getBarberById(c.env.DB, booking.barber_id) : null;
  const services = booking.barber_id ? await listServicesForBarber(c.env.DB, booking.barber_id) : [];
  const service = services.find((s) => s.id === booking.service_id);
  const serviceName = service?.name ?? 'Appointment';
  const serviceSlug = service?.slug ?? '';
  const dates = booking.barber_id ? nextBookableDates(hoursMap.get(booking.barber_id) ?? [], Date.now()) : [];
  const emailNote = booking.confirmation_sent
    ? 'A confirmation email was sent.'
    : booking.guest_email
      ? 'Email is in demo mode (no mail key configured), so no confirmation email was sent.'
      : 'No email address was provided, so no confirmation email was sent.';
  return c.html(confirmationPage(booking, serviceName, serviceSlug, dates, whenLabel(booking.start_ts, booking.end_ts), emailNote, barber));
});

/** Move a confirmed booking to a new day/time. Atomic single-statement move. */
bookingRoutes.post('/book/:id/reschedule', async (c) => {
  const id = c.req.param('id');
  if (!/^CSH-[A-Z0-9]{6}$/.test(id)) return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);
  const booking = await getBooking(c.env.DB, id);
  if (!booking || booking.status === 'cancelled' || !booking.barber_id)
    return c.html(errorPage('Not found', 'Unknown booking reference.'), 404);

  const form = await c.req.parseBody();
  const date = typeof form.date === 'string' ? form.date.trim() : '';
  const slotStart = Number(form.slotStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isDateInWindow(date, Date.now()))
    return c.html(errorPage('Reschedule failed', 'Pick a valid day within the next 14 days.'), 400);
  if (!Number.isFinite(slotStart) || slotStart <= 0)
    return c.html(errorPage('Reschedule failed', 'Pick a time slot.'), 400);

  const services = await listServicesForBarber(c.env.DB, booking.barber_id);
  const service = services.find((s) => s.id === booking.service_id);
  if (!service) return c.html(errorPage('Reschedule failed', 'Unknown service.'), 400);

  // Valid slots for the day, excluding this booking's own current window —
  // always within the booking's barber's hours.
  const bounds = localDayBounds(date);
  if (!bounds) return c.html(errorPage('Reschedule failed', 'Invalid date.'), 400);
  const busy = await listBusyRangesExcluding(c.env.DB, bounds.start, bounds.end, id, booking.barber_id);
  const hours = await listBarberHours(c.env.DB, booking.barber_id);
  const validStarts = new Set(
    generateSlotsForDate(date, hours, service.duration_minutes, busy, Date.now()).map((s) => s.startTs),
  );
  if (!validStarts.has(slotStart)) {
    return c.html(errorPage('Reschedule failed', 'That time was just taken or is no longer valid — pick another.'), 409);
  }

  const endTs = slotStart + service.duration_minutes * 60 * 1000;
  const moved = await rescheduleBooking(c.env.DB, id, booking.barber_id, slotStart, endTs);
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
