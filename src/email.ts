// Email seam for the demo — exactly ONE module calls the email provider.
// Resend (https://api.resend.com/emails) when RESEND_API_KEY is set;
// otherwise DEMO MODE: nothing is sent, the event is logged, and the caller
// is told the send was skipped so the UI can say so honestly.

import type { Bindings, Booking } from './types';

export interface SendResult {
  sent: boolean;
  demoMode: boolean;
  reason: string;
}

export function emailEnabled(env: Bindings): boolean {
  return Boolean(env.RESEND_API_KEY);
}

async function sendEmail(
  env: Bindings,
  bookingId: string,
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const key = env.RESEND_API_KEY;
  if (!key) {
    // PII-free log: booking id + recipient presence only, never the address.
    console.log(
      JSON.stringify({
        msg: 'email_demo_mode',
        booking: bookingId,
        has_recipient: true,
        subject_bytes: subject.length,
        body_bytes: html.length,
      }),
    );
    return { sent: false, demoMode: true, reason: 'RESEND_API_KEY not set — demo mode' };
  }
  const from = env.EMAIL_FROM || 'The Closer Shave (demo) <demo@localhost>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(
        JSON.stringify({
          msg: 'email_send_failed',
          booking: bookingId,
          has_recipient: true,
          status: res.status,
          body: body.slice(0, 300),
        }),
      );
      return { sent: false, demoMode: false, reason: `Resend HTTP ${res.status}` };
    }
    console.log(JSON.stringify({ msg: 'email_sent', booking: bookingId, has_recipient: true }));
    return { sent: true, demoMode: false, reason: 'sent via Resend' };
  } catch (err) {
    console.error(
      JSON.stringify({ msg: 'email_send_error', booking: bookingId, err: String(err).slice(0, 200) }),
    );
    return { sent: false, demoMode: false, reason: `transport error: ${String(err).slice(0, 120)}` };
  }
}

const SHOP_LINE = 'The Closer Shave · 411A Brannan St, San Francisco, CA 94107 · (415) 465-5915';

function bookingSummary(b: Booking, serviceName: string, whenLabel: string): string {
  return `<p style="font-size:16px">Hi ${esc(b.guest_name)},</p>
<p>Your appointment at <strong>${SHOP_NAME_ESC}</strong> is confirmed:</p>
<ul>
  <li><strong>${esc(serviceName)}</strong> with ${esc(b.barber)}</li>
  <li><strong>${esc(whenLabel)}</strong></li>
  <li>Reference: <strong>${esc(b.id)}</strong></li>
</ul>
<p>${SHOP_LINE}</p>
<p style="color:#666;font-size:12px">This message comes from an unofficial concept demo, not the real shop.</p>`;
}

// Local esc to keep this module dependency-light (no template import cycles).
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const SHOP_NAME_ESC = 'The Closer Shave';

export async function sendConfirmationEmail(
  env: Bindings,
  booking: Booking,
  serviceName: string,
  whenLabel: string,
): Promise<SendResult> {
  if (!booking.guest_email) {
    return { sent: false, demoMode: !emailEnabled(env), reason: 'no guest email on booking' };
  }
  return sendEmail(
    env,
    booking.id,
    booking.guest_email,
    `Appointment confirmed — ${serviceName} on ${whenLabel}`,
    bookingSummary(booking, serviceName, whenLabel),
  );
}

export async function sendReminderEmail(
  env: Bindings,
  booking: Booking,
  serviceName: string,
  whenLabel: string,
): Promise<SendResult> {
  if (!booking.guest_email) {
    return { sent: false, demoMode: !emailEnabled(env), reason: 'no guest email on booking' };
  }
  return sendEmail(
    env,
    booking.id,
    booking.guest_email,
    `Reminder: ${serviceName} tomorrow at ${whenLabel}`,
    `<p style="font-size:16px">Hi ${esc(booking.guest_name)},</p>
<p>This is a friendly reminder of your appointment <strong>tomorrow</strong>:</p>
<ul>
  <li><strong>${esc(serviceName)}</strong> with ${esc(booking.barber)}</li>
  <li><strong>${esc(whenLabel)}</strong></li>
  <li>Reference: <strong>${esc(booking.id)}</strong></li>
</ul>
<p>Need to change it? Call ${SHOP_LINE}.</p>
<p style="color:#666;font-size:12px">This message comes from an unofficial concept demo, not the real shop.</p>`,
  );
}
