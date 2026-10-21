/** New references use the runtime's UUID generator without biased modulo mapping. */
export function generateBookingId(): string {
  return `CSH-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
}

/** Existing six-character references remain valid for saved links and emails. */
export function isBookingId(value: string): boolean {
  return /^CSH-(?:[A-Z0-9]{6}|[0-9A-F]{32})$/.test(value);
}
