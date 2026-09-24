// Cron sweep: runs every 30 minutes via Workers Cron Triggers.
// 1. Retries booking confirmation emails that weren't sent at booking time.
// 2. Sends 24h reminders for appointments starting within the next 23–25h.
// Email goes through the Resend seam; without RESEND_API_KEY everything is
// demo mode (logged, not sent) — the sweep still marks nothing as sent.
import {
  getBarberById,
  listPendingConfirmations,
  listPendingReminders,
  markConfirmationSent,
  markReminderSent,
} from './db';
import { emailEnabled, sendConfirmationEmail, sendReminderEmail } from './email';
import { whenLabel } from './routes/booking';
import type { Bindings, Booking } from './types';

export interface SweepResult {
  confirmationsAttempted: number;
  confirmationsSent: number;
  remindersAttempted: number;
  remindersSent: number;
  demoMode: boolean;
}

async function serviceNameFor(env: Bindings, booking: Booking): Promise<string> {
  const row = await env.DB.prepare('SELECT name FROM services WHERE id = ?1')
    .bind(booking.service_id)
    .first<{ name: string }>();
  return row?.name ?? 'Appointment';
}

async function barberNameFor(env: Bindings, booking: Booking): Promise<string> {
  if (booking.barber_id) {
    const barber = await getBarberById(env.DB, booking.barber_id);
    if (barber) return barber.name;
  }
  return booking.barber;
}

export async function runReminderSweep(env: Bindings): Promise<SweepResult> {
  const demoMode = !emailEnabled(env);
  const result: SweepResult = {
    confirmationsAttempted: 0,
    confirmationsSent: 0,
    remindersAttempted: 0,
    remindersSent: 0,
    demoMode,
  };

  const confirmations = await listPendingConfirmations(env.DB);
  for (const b of confirmations) {
    result.confirmationsAttempted++;
    try {
      const r = await sendConfirmationEmail(env, b, await serviceNameFor(env, b), whenLabel(b.start_ts, b.end_ts), await barberNameFor(env, b));
      if (r.sent) {
        await markConfirmationSent(env.DB, b.id);
        result.confirmationsSent++;
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'cron_confirmation_error', id: b.id, err: String(err).slice(0, 200) }));
    }
  }

  const now = Date.now();
  const reminders = await listPendingReminders(env.DB, now + 23 * 3600 * 1000, now + 25 * 3600 * 1000);
  for (const b of reminders) {
    result.remindersAttempted++;
    try {
      const r = await sendReminderEmail(env, b, await serviceNameFor(env, b), whenLabel(b.start_ts, b.end_ts), await barberNameFor(env, b));
      if (r.sent) {
        await markReminderSent(env.DB, b.id);
        result.remindersSent++;
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'cron_reminder_error', id: b.id, err: String(err).slice(0, 200) }));
    }
  }

  console.log(JSON.stringify({ msg: 'reminder_sweep', ...result }));
  return result;
}
