// escapeHtml — REQUIRED for any request/DB-derived interpolation into HTML.
// (Pattern from the edge-cal reference architecture.)

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/** Escape for embedding JSON inside a <script> tag. */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
