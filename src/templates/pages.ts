// Server-rendered pages (template literals + escapeHtml discipline).
// No build step: interactivity is vanilla JS embedded in the booking page.
import { escapeHtml } from '../html';
import {
  SHOP_ADDRESS,
  SHOP_NAME,
  SHOP_PHONE,
  SHOP_PHONE_LINK,
  type Barber,
  type Booking,
  type DayWindow,
  type Service,
} from '../types';

const FAVICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMTQxNDE0Ii8+PHRleHQgeD0iNTAiIHk9IjY4IiBmb250LXNpemU9IjUyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7inII8L3RleHQ8L3N2Zz4=';

/* Hallmark · macrostructure: Narrative Workflow · genre: editorial
 * theme: custom (warm ink paper · brass accent · Fraunces + Plex Sans + Plex Mono)
 * nav: N6 newspaper masthead · footer: Ft2 inline rule
 * enrichment: none, typographic (the imagery is 7 real Booksy photos)
 * color strategy: Committed (dark ink surface) · temperature: warm
 * pre-emit critique: P5 H4 E5 S4 R5 V5
 * slop-test: 58/58 pass (gate 38: mono is a data register, never running prose) */
const CSS = `
:root{
  --color-paper:oklch(0.165 0.014 78);
  --color-paper-2:oklch(0.205 0.016 78);
  --color-paper-3:oklch(0.25 0.018 78);
  --color-ink:oklch(0.935 0.018 82);
  --color-ink-2:oklch(0.70 0.028 76);
  --color-ink-3:oklch(0.55 0.025 76);
  --color-rule:oklch(0.33 0.02 76);
  --color-rule-soft:oklch(0.25 0.016 76);
  --color-accent:oklch(0.76 0.125 80);
  --color-accent-ink:oklch(0.165 0.014 78);
  --color-accent-dim:oklch(0.60 0.10 80);
  --color-danger:oklch(0.64 0.17 24);
  --color-danger-ink:oklch(0.90 0.05 24);
  --color-ok:oklch(0.74 0.13 155);
  --color-ok-ink:oklch(0.88 0.06 155);
  --color-focus:oklch(0.82 0.14 80);
  --color-selected:oklch(0.235 0.032 78);
  --color-field:oklch(0.13 0.012 78);
  --color-tint-danger:oklch(0.22 0.05 24);
  --color-tint-ok:oklch(0.20 0.05 155);
  --color-ticket-head:oklch(0.20 0.02 78);
  --color-img-outline:rgba(255,255,255,0.1);
  --font-display:"Fraunces",Georgia,"Times New Roman",serif;
  --font-body:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --space-xs:0.5rem;--space-sm:0.75rem;--space-md:1rem;--space-lg:1.5rem;--space-xl:2.25rem;--space-2xl:3.5rem;
  --radius:10px;
  --ease-out:cubic-bezier(0.16,1,0.3,1);
  --dur:200ms;
}
*{box-sizing:border-box}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow-x:clip}
body{margin:0;background:var(--color-paper);color:var(--color-ink);font-family:var(--font-body);line-height:1.6;overflow-x:clip}
h1,h2,h3{text-wrap:balance;font-style:normal}
p,li,figcaption{text-wrap:pretty}
a{color:var(--color-accent)}
:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px;border-radius:4px}
.skip{position:absolute;left:-9999px;top:0;background:var(--color-accent);color:var(--color-accent-ink);padding:12px 16px;font-weight:700;z-index:50;border-radius:0 0 8px 0}
.skip:focus{left:0}

/* ---- N6 masthead: issue line + nameplate + dateline ---- */
.issue-line{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;align-items:center;
  border-top:3px double var(--color-accent);border-bottom:1px solid var(--color-rule);
  color:var(--color-accent);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;
  padding:8px 12px;text-align:center}
.issue-line .sep{color:var(--color-ink-3)}
.wrap{max-width:640px;margin:0 auto;padding:0 20px 56px}
.masthead{padding:var(--space-xl) 0 var(--space-lg);text-align:center;border-bottom:3px double var(--color-accent);margin-bottom:var(--space-xl)}
.nameplate{font-family:var(--font-display);font-weight:600;font-size:clamp(2.4rem,8vw,3.6rem);line-height:1.05;margin:0;letter-spacing:0.01em;overflow-wrap:anywhere}
.dateline{margin-top:var(--space-sm);color:var(--color-ink-2);font-size:14px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;align-items:center}
.dateline .phone{font-family:var(--font-mono);font-size:14px}
.section-nav{margin-top:var(--space-md);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 20px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase}
.section-nav a{color:var(--color-ink-2);text-decoration:none;border-bottom:1px solid transparent;padding-bottom:2px;transition-property:border-color,color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.section-nav a:hover{color:var(--color-accent);border-bottom-color:var(--color-accent)}

/* ---- Narrative Workflow stages ---- */
.stage{margin-bottom:var(--space-2xl);scroll-margin-top:12px}
.stage-head{display:flex;flex-direction:column;gap:4px;margin-bottom:var(--space-md)}
.stage-num{font-family:var(--font-display);font-weight:700;font-size:1rem;color:var(--color-accent);letter-spacing:0.22em}
.stage-head h2{font-family:var(--font-display);font-weight:600;font-size:1.5rem;margin:0;overflow-wrap:anywhere;min-width:0}
.stage-head .stage-rule{border-top:1px solid var(--color-rule);margin-top:8px}

/* ---- Price board: services with dotted leaders ---- */
.service{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--color-rule-soft);border-radius:var(--radius);
  padding:12px 16px;margin-bottom:10px;cursor:pointer;background:var(--color-paper-2);
  transition-property:border-color,background-color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.service:hover{border-color:var(--color-rule)}
.service:active{scale:0.99}
.service:has(input:checked){border-color:var(--color-accent);background:var(--color-selected)}
.service input{margin-top:5px;accent-color:var(--color-accent);width:18px;height:18px;flex:none;cursor:pointer}
.svc-body{flex:1;min-width:0}
.svc-main{display:flex;align-items:baseline;gap:12px}
.svc-main strong{font-weight:600;font-size:16px}
.dots{flex:1;border-bottom:2px dotted var(--color-rule);transform:translateY(-4px);min-width:16px}
.svc-main .p{font-family:var(--font-mono);font-variant-numeric:tabular-nums;color:var(--color-accent);font-weight:600;font-size:16px;white-space:nowrap}
.svc-sub{color:var(--color-ink-2);font-size:13px;margin-top:4px}
.svc-sub .dur{font-family:var(--font-mono);font-size:12px;letter-spacing:0.04em}

/* ---- Day + time pickers ---- */
.dates{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin}
.date-btn{flex:0 0 auto;border:1px solid var(--color-rule-soft);background:var(--color-paper-2);color:var(--color-ink);
  border-radius:var(--radius);padding:12px;cursor:pointer;text-align:center;min-width:78px;min-height:60px;
  transition-property:border-color,background-color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.date-btn small{display:block;color:var(--color-ink-2);font-size:11px;letter-spacing:0.08em;text-transform:uppercase}
.date-btn .dlabel{font-family:var(--font-mono);font-size:14px}
.date-btn:active{scale:0.97}
.date-btn.sel{border-color:var(--color-accent);background:var(--color-selected)}
.slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.slot-btn{border:1px solid var(--color-rule-soft);background:var(--color-paper-2);color:var(--color-ink);border-radius:8px;
  padding:12px 4px;cursor:pointer;font-family:var(--font-mono);font-size:14px;font-variant-numeric:tabular-nums;min-height:48px;
  transition-property:border-color,background-color,scale;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.slot-btn:active{scale:0.96}
.slot-btn.sel{border-color:var(--color-accent);background:var(--color-selected);font-weight:600}

/* ---- Forms ---- */
.field{margin-bottom:14px}
.field label{display:block;font-size:13px;font-weight:500;color:var(--color-ink-2);margin-bottom:5px;letter-spacing:0.02em}
.field input,.field textarea,.field select{width:100%;background:var(--color-field);border:1px solid var(--color-rule-soft);
  color:var(--color-ink);border-radius:8px;padding:12px;font-size:16px;font-family:var(--font-body);
  transition-property:border-color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--color-accent);outline:2px solid var(--color-focus);outline-offset:1px}
.btn{display:block;width:100%;background:var(--color-accent);color:var(--color-accent-ink);border:0;border-radius:var(--radius);
  padding:16px;font-size:17px;font-weight:700;font-family:var(--font-body);cursor:pointer;margin-top:12px;min-height:56px;
  transition-property:background-color,scale;transition-duration:var(--dur);transition-timing-function:var(--ease-out);text-decoration:none}
.btn:active{scale:0.97}
.btn:disabled{opacity:0.55;cursor:not-allowed;scale:1}
.btn.secondary{background:transparent;border:1px solid var(--color-accent);color:var(--color-accent)}
.hint{color:var(--color-ink-2);font-size:13px}
.tbd{color:var(--color-accent);font-size:12px;font-weight:700;letter-spacing:0.06em}
.mono{font-family:var(--font-mono)}
.err{background:var(--color-tint-danger);border:1px solid var(--color-danger);color:var(--color-danger-ink);border-radius:8px;padding:12px;margin-bottom:14px;font-size:14px}
.ok{background:var(--color-tint-ok);border:1px solid var(--color-ok);color:var(--color-ok-ink);border-radius:8px;padding:12px;margin-bottom:14px;font-size:14px}

/* ---- Editorial info sections ---- */
.section{margin-bottom:var(--space-2xl);scroll-margin-top:12px}
.section-head{display:flex;flex-direction:column;gap:4px;margin-bottom:var(--space-md)}
.section-head .kicker{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--color-accent);font-weight:600}
.section-head h2{font-family:var(--font-display);font-weight:600;font-size:1.5rem;margin:0;overflow-wrap:anywhere;min-width:0}
.section-head .rule{border-top:1px solid var(--color-rule);margin-top:8px}
.ratings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:var(--space-md)}
.rating-card{border:1px solid var(--color-rule-soft);border-radius:var(--radius);padding:16px;background:var(--color-paper-2);
  text-decoration:none;color:var(--color-ink);display:block;
  transition-property:border-color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.rating-card:active{scale:0.99}
.rating-card:hover{border-color:var(--color-accent)}
.rating-card .score{font-family:var(--font-display);font-size:1.9rem;font-weight:700;color:var(--color-accent);line-height:1.1}
.rating-card .n{font-size:14px;margin-top:2px}
.rating-card .src{font-size:11px;color:var(--color-ink-2);letter-spacing:0.06em;text-transform:uppercase;margin-top:6px}
.quote{border:1px solid var(--color-rule-soft);border-radius:var(--radius);background:var(--color-paper-2);
  margin:0 0 10px;padding:16px 20px 16px;position:relative}
.quote .qmark{font-family:var(--font-display);font-size:2.6rem;line-height:1;color:var(--color-accent);display:block;margin-bottom:4px}
.quote blockquote{margin:0;font-family:var(--font-display);font-size:1.15rem;line-height:1.45;font-style:normal}
.quote figcaption{margin-top:8px;font-size:12px;color:var(--color-ink-2);letter-spacing:0.06em;text-transform:uppercase}
.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:var(--color-paper-3);
  outline:1px solid var(--color-img-outline);outline-offset:-1px}
.gallery figcaption{font-size:12px;color:var(--color-ink-2);grid-column:1/-1;margin-top:4px}
table.ledger{width:100%;border-collapse:collapse;font-size:13px}
table.ledger th,table.ledger td{text-align:left;padding:9px 6px;border-bottom:1px solid var(--color-rule-soft);vertical-align:top}
.hours-table td:first-child{color:var(--color-ink-2);width:42%}
.about-links{margin-top:var(--space-md);font-size:14px}

/* ---- Appointment ticket (confirmation) ---- */
.ticket{border:1px solid var(--color-rule);border-radius:var(--radius);background:var(--color-paper-2);overflow:hidden;margin-bottom:var(--space-xl)}
.ticket-head{background:var(--color-ticket-head);border-bottom:2px dashed var(--color-accent-dim);padding:16px 20px;text-align:center}
.ticket-head .k{font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:var(--color-accent);font-weight:600}
.ticket-head h2{font-family:var(--font-display);font-size:1.6rem;margin:8px 0 0;font-weight:600}
.ticket-body{padding:20px}
.ref{font-family:var(--font-mono);background:var(--color-field);border:1px dashed var(--color-accent-dim);
  border-radius:8px;padding:12px 16px;display:inline-block;margin:4px 0 16px;font-size:19px;letter-spacing:2px;color:var(--color-accent)}
table.ticket-table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:6px}
table.ticket-table th,table.ticket-table td{text-align:left;padding:8px 4px;border-bottom:1px dotted var(--color-rule);vertical-align:top}
table.ticket-table th{color:var(--color-ink-2);font-weight:500;width:32%;font-size:12px;letter-spacing:0.06em;text-transform:uppercase}
.ticket-foot{border-top:2px dashed var(--color-accent-dim);padding:16px 20px}

/* ---- Ft2 inline-rule footer ---- */
footer.colophon{margin-top:var(--space-2xl);border-top:1px solid var(--color-rule);padding-top:var(--space-md);
  color:var(--color-ink-2);font-size:12px;display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:center;text-align:center}
footer.colophon .demo-tag{color:var(--color-accent);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;font-size:11px}

/* ---- Barber cards (multi-barber roster) ---- */
.barber-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:var(--space-md)}
.barber-card{border:1px solid var(--color-rule-soft);border-radius:var(--radius);background:var(--color-paper-2);
  padding:14px;cursor:pointer;display:block;
  transition-property:border-color,background-color;transition-duration:var(--dur);transition-timing-function:var(--ease-out)}
.barber-card:hover{border-color:var(--color-rule)}
.barber-card:has(input:checked){border-color:var(--color-accent);background:var(--color-selected)}
.barber-card input{position:absolute;opacity:0;pointer-events:none}
.barber-top{display:flex;gap:12px;align-items:center}
.barber-photo{width:64px;height:64px;flex:none;border-radius:50%;object-fit:cover;background:var(--color-paper-3);
  outline:1px solid var(--color-img-outline);outline-offset:-1px}
.barber-name{font-weight:700;font-size:16px;line-height:1.3}
.barber-meta{color:var(--color-ink-2);font-size:12.5px;margin-top:2px}
.barber-meta .stars{color:var(--color-accent);font-weight:600}
.barber-hours{margin:10px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--color-ink-2)}
.barber-hours li{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
.barber-hours .dow{letter-spacing:0.04em}
.barber-booksy{font-size:12.5px;margin-top:8px}
.barber-profile{display:flex;gap:16px;align-items:flex-start;border:1px solid var(--color-rule-soft);border-radius:var(--radius);
  background:var(--color-paper-2);padding:16px;margin-bottom:12px}
.barber-profile .barber-photo{width:88px;height:88px}
.ticket-barber{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.ticket-barber .barber-photo{width:52px;height:52px}

/* ---- Selected-barber spotlight (booking step 1) ---- */
/* Live region: re-renders on every barber selection change. min-height reserves
   the space so the flow below never jumps when the selection changes. */
.barber-spotlight{min-height:380px;margin-bottom:var(--space-md)}
.spotlight-empty{display:flex;align-items:center;justify-content:center;min-height:inherit;
  border:1px dashed var(--color-rule);border-radius:var(--radius);color:var(--color-ink-2);font-size:14px;padding:24px;text-align:center}
.spotlight-card{display:flex;gap:16px;align-items:center;border:1px solid var(--color-rule-soft);
  border-radius:var(--radius);background:var(--color-paper-2);padding:20px;margin-bottom:var(--space-md)}
.spotlight-photo{width:88px;height:88px;flex:none;border-radius:50%;object-fit:cover;background:var(--color-paper-3);
  outline:1px solid var(--color-img-outline);outline-offset:-1px}
.spotlight-info{min-width:0}
.spotlight-info h3{margin:0 0 4px;font-size:1.25rem;font-weight:700;line-height:1.25;text-wrap:balance}
.spotlight-work-label{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--color-accent);
  font-weight:600;margin:0 0 8px}
.spotlight-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.spotlight-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:var(--color-paper-3);
  outline:1px solid var(--color-img-outline);outline-offset:-1px}
/* Subtle re-render cue on selection change: opacity + translateY only, never layout. */
@keyframes spotlight-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.spotlight-enter{animation:spotlight-in var(--dur) var(--ease-out)}

@media(max-width:520px){
  .barber-grid{grid-template-columns:minmax(0,1fr)}
  .slots{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gallery{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ratings{grid-template-columns:repeat(2,minmax(0,1fr))}
  .barber-spotlight{min-height:470px}
  .spotlight-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}
  .stage-head h2,.section-head h2{font-size:1.3rem}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-duration:0.01ms !important;animation:none !important}
}
`;

const FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`;

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="description" content="Unofficial concept demo of online booking for The Closer Shave barbershop. Not affiliated with the shop.">
<title>${escapeHtml(title)} — ${escapeHtml(SHOP_NAME)} (demo)</title>
<link rel="icon" href="${FAVICON}">
${FONTS}
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#bookform">Skip to booking</a>
<div class="issue-line" role="note"><span>Concept demo</span><span class="sep" aria-hidden="true">·</span><span>Not affiliated with ${escapeHtml(SHOP_NAME)}</span><span class="sep" aria-hidden="true">·</span><span>No real appointments are made here</span></div>
<div class="wrap">
<header class="masthead">
  <h1 class="nameplate">${escapeHtml(SHOP_NAME)}</h1>
  <div class="dateline"><span>${escapeHtml(SHOP_ADDRESS)}</span><a class="phone" href="tel:${SHOP_PHONE_LINK}">${escapeHtml(SHOP_PHONE)}</a></div>
  <nav class="section-nav" aria-label="Page sections"><a href="#bookform">Book</a><a href="#barbers">Barbers</a><a href="#ratings">Ratings</a><a href="#photos">Photos</a><a href="#about">About</a></nav>
</header>
<main>
${body}
</main>
<footer class="colophon">
  <span class="demo-tag">Concept demo</span>
  <span>Not affiliated with ${escapeHtml(SHOP_NAME)}</span>
  <span>${escapeHtml(SHOP_ADDRESS)}</span>
  <span>Unofficial booking exploration</span>
</footer>
</div>
</body>
</html>`;
}

export function formatPrice(s: Service): string {
  if (s.price_cents == null) return '<span class="tbd">TBD</span>';
  return '$' + (s.price_cents / 100).toFixed(0);
}

/** dateStr YYYY-MM-DD -> {dow: "Thu", label: "Sep 25"} rendered in shop tz */
export function dateChipParts(dateStr: string): { dow: string; label: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  // noon UTC of the calendar day; labels rendered in shop tz via toLocaleDateString
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return {
    dow: dt.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }),
    label: dt.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }),
  };
}

const BOOKSY_SHOP_URL = 'https://booksy.com/en-us/1150636_the-closer-shave_barber-shop_134715_san-francisco';
const BOOKSY_BARBER_URL = 'https://booksy.com/en-us/1150634_itsrjstyles_barber-shop_134715_san-francisco';
const BOOKSY_BOOK_URL = 'https://theclosershave4159.booksy.com';
const SHOP_SITE_URL = 'https://theclosershavesf.com';
const YELP_URL = 'https://www.yelp.com/biz/the-closer-shave-san-francisco-3';
const NXCUT_URL = 'https://www.nxcut.com/salons/us/the-closer-shave';

const PHOTO_FALLBACK =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQwNDAzOCIvPjx0ZXh0IHg9IjUwIiB5PSI2NCIgZm9udC1zaXplPSI0NCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2M5YjY3OSI+4p2kPC90ZXh0Pjwvc3ZnPg==';

/** <img> attrs shared by barber photos: lazy, no-referrer, graceful fallback. */
export function barberPhotoImg(b: Barber, cls = 'barber-photo'): string {
  return `<img class="${cls}" src="${escapeHtml(b.photo_url)}" alt="Photo of ${escapeHtml(b.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PHOTO_FALLBACK}'">`;
}

/**
 * The "selected barber" detail panel shown directly under the barber picker in
 * booking step 1. Re-rendered client-side on every selection change.
 * Rating shown as the Booksy aggregate only — individual review text is never
 * imported, so none is displayed here.
 */
export function barberSpotlightHtml(b: Barber | null): string {
  if (!b) {
    return '<div class="spotlight-empty"><p>Choose a barber to see their work.</p></div>';
  }
  const gallery = (b.gallery_images ?? [])
    .map(
      (src, i) =>
        `<img src="${escapeHtml(src)}" alt="Work example ${i + 1} by ${escapeHtml(b.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PHOTO_FALLBACK}'">`,
    )
    .join('\n');
  return `<div class="spotlight-inner">
  <div class="spotlight-card">
    ${barberPhotoImg(b, 'spotlight-photo')}
    <div class="spotlight-info">
      <h3>${escapeHtml(b.name)}</h3>
      <p class="barber-meta"><span class="stars">★</span> ${b.rating.toFixed(1)} (${b.review_count} Booksy reviews)</p>
      <p class="barber-booksy"><a href="${escapeHtml(b.booksy_url)}" target="_blank" rel="noopener">View ${escapeHtml(b.name)} on Booksy</a></p>
    </div>
  </div>
  <p class="spotlight-work-label">Their work</p>
  <div class="spotlight-gallery">${gallery}</div>
</div>`;
}

/** Minimal per-barber detail payload embedded in the booking page so the
 *  spotlight can re-render instantly on selection change (no fetch). */
export function barberDetailPayload(barbers: Barber[]): string {
  return JSON.stringify(
    barbers.map((b) => ({
      id: b.id,
      name: b.name,
      photo_url: b.photo_url,
      booksy_url: b.booksy_url,
      rating: b.rating,
      review_count: b.review_count,
      gallery: b.gallery_images ?? [],
    })),
  ).replace(/</g, '\\u003c');
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "14:00" -> "2:00 PM" */
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Compact per-barber hours for cards: "Tue 12:00 PM – 7:00 PM" lines, split shifts joined. */
export function hoursListHtml(windows: DayWindow[]): string {
  const items: string[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const day = windows.filter((w) => w.day_of_week === dow);
    if (!day.length) continue;
    const ranges = day.map((w) => `${fmtTime(w.open_time)} – ${fmtTime(w.close_time)}`).join(', ');
    items.push(`<li><span class="dow">${DOW_SHORT[dow]}</span><span>${ranges}</span></li>`);
  }
  return items.length ? `<ul class="barber-hours" aria-label="Hours">${items.join('')}</ul>` : '<p class="hint">Hours not listed.</p>';
}

/** Real shop content, fetched live 2026-09-24. Ratings link out to the
 *  live listings; individual Booksy reviews render on booksy.com. */
function shopInfoSections(barbers: Barber[], hoursMap: Map<string, DayWindow[]>): string {
  const roster = barbers
    .map(
      (b) => `<article class="barber-profile">
  ${barberPhotoImg(b)}
  <div style="min-width:0">
    <h3 style="margin:0 0 2px">${escapeHtml(b.name)}</h3>
    <p class="barber-meta" style="margin:0 0 8px"><span class="stars">★ ${b.rating.toFixed(1)}</span> · ${b.review_count} Booksy reviews${b.phone ? ` · <a href="tel:+1${escapeHtml(b.phone.replace(/\D/g, ''))}">${escapeHtml(b.phone)}</a>` : ''}${b.notes ? ` · ${escapeHtml(b.notes)}` : ''}</p>
    ${hoursListHtml(hoursMap.get(b.id) ?? [])}
    <p class="barber-booksy"><a href="${escapeHtml(b.booksy_url)}" target="_blank" rel="noopener">View ${escapeHtml(b.name)} on Booksy</a></p>
  </div>
</article>`,
    )
    .join('\n');

  const photos: [string, string][] = [
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150636/biz_photo/8c13bcf2af8c41b29d6a0affa70f7a-the-closer-shave-biz-photo-05368c4cea2d412387ca715b5f9ee7-booksy.jpeg?size=640x427', 'The Closer Shave shop photo'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/biz_photo/03ecfaee67954b75be46356faece14-itsrjstyles-biz-photo-71b76fed5ae84af1acc3900904a0df-booksy.jpeg?size=640x427', 'itsrjstyles at work'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/1d10c08414ed471183b02bcb96b5ad-itsrjstyles-inspiration-d67b6bda229744e392a2cb499e6783-booksy.jpeg?size=360x360', 'Work example 1'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/98ee272139164319b873565d323186-itsrjstyles-inspiration-c5b745db44c648f1b33dcef2bbbc85-booksy.jpeg?size=360x360', 'Work example 2'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/9346377235144f4da73d2329d5233d-itsrjstyles-inspiration-fffab52c23664b8d95a76511d6a3a8-booksy.jpeg?size=360x360', 'Work example 3'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/c497b2ba6510453bbd9ed4061d94f6-the-closer-shave-inspiration-17cd216871bc4e29914d82acb28981-booksy.jpeg?size=360x360', 'Work example 4'],
    ['https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/0b8c308e577a445f874d9dcddc5869-the-closer-shave-inspiration-49d2f22e2fe64b2480df87cc575658-booksy.jpeg?size=360x360', 'Work example 5'],
  ];
  const gallery = photos
    .map(
      ([src, alt]) =>
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`,
    )
    .join('\n');

  return `
<section class="section" id="barbers" aria-label="The barbers">
  <div class="section-head"><span class="kicker">The chairs</span><h2>Barbers</h2><span class="rule" aria-hidden="true"></span></div>
  ${roster}
  <p class="hint">Hours are each barber's own Booksy schedule — a day not listed means they are closed. Profiles link to their live Booksy pages.</p>
</section>
<section class="section" id="ratings" aria-label="Ratings and reviews">
  <div class="section-head"><span class="kicker">Word of mouth</span><h2>Ratings &amp; reviews</h2><span class="rule" aria-hidden="true"></span></div>
  <div class="ratings">
    <a class="rating-card" href="${BOOKSY_SHOP_URL}" target="_blank" rel="noopener"><div class="score">5.0</div><div class="n">319 reviews</div><div class="src">via Booksy · The Closer Shave</div></a>
    <a class="rating-card" href="${BOOKSY_BARBER_URL}" target="_blank" rel="noopener"><div class="score">5.0</div><div class="n">96 reviews</div><div class="src">via Booksy · itsrjstyles</div></a>
    <a class="rating-card" href="${NXCUT_URL}" target="_blank" rel="noopener"><div class="score">4.5</div><div class="n">439 reviews</div><div class="src">via NxCut</div></a>
    <a class="rating-card" href="${YELP_URL}" target="_blank" rel="noopener"><div class="score">Yelp</div><div class="n">103 photos</div><div class="src">via Yelp</div></a>
  </div>
  <figure class="quote"><span class="qmark" aria-hidden="true">&ldquo;</span><blockquote>Ricky is the barber I trust for a great haircut.</blockquote><figcaption>via Atly</figcaption></figure>
  <figure class="quote"><span class="qmark" aria-hidden="true">&ldquo;</span><blockquote>I always get a clean fade and a dope haircut here.</blockquote><figcaption>via Atly</figcaption></figure>
  <p class="hint">Individual Booksy reviews load on booksy.com: the ratings above link to the live listings.</p>
</section>
<section class="section" id="photos" aria-label="Photos">
  <div class="section-head"><span class="kicker">The work</span><h2>Photos</h2><span class="rule" aria-hidden="true"></span></div>
  <div class="gallery">${gallery}
    <figcaption>Photos: The Closer Shave / itsrjstyles, via Booksy.</figcaption>
  </div>
</section>
<section class="section" id="about" aria-label="About the shop">
  <div class="section-head"><span class="kicker">The shop</span><h2>About</h2><span class="rule" aria-hidden="true"></span></div>
  <p>Meet Ricky, the barber behind <strong>itsrjstyles</strong>. Eight years behind the chair, and in 2024 he opened The Closer Shave on Brannan St in SoMa: precision cuts, hot-towel straight-razor shaves, beard work, and facials. <span class="hint">(via <a href="${SHOP_SITE_URL}" target="_blank" rel="noopener">theclosershavesf.com</a>)</span></p>
  <table class="ledger hours-table">
    <tr><td>Sunday</td><td>11:00 AM – 6:00 PM</td></tr>
    <tr><td>Monday</td><td>Closed</td></tr>
    <tr><td>Tuesday</td><td>2:00 PM – 6:00 PM</td></tr>
    <tr><td>Wednesday</td><td>11:00 AM – 7:30 PM</td></tr>
    <tr><td>Thursday</td><td>2:00 PM – 8:00 PM</td></tr>
    <tr><td>Friday</td><td>10:30 AM – 8:00 PM</td></tr>
    <tr><td>Saturday</td><td>11:00 AM – 6:00 PM</td></tr>
  </table>
  <p class="hint">Hours via the Booksy shop listing.</p>
  <p class="about-links"><a href="${BOOKSY_BOOK_URL}" target="_blank" rel="noopener">Book on Booksy</a> ·
  <a href="https://www.instagram.com/itsrjstyles_/" target="_blank" rel="noopener">@itsrjstyles_</a> ·
  <a href="https://www.instagram.com/theclosershavesf/" target="_blank" rel="noopener">@theclosershavesf</a></p>
</section>`;
}

export function bookingPage(
  barbers: Barber[],
  selectedBarberId: string,
  services: Service[],
  dates: string[],
  hoursMap: Map<string, DayWindow[]>,
  error?: string,
): string {
  const barberCards = barbers
    .map(
      (b, i) => `<label class="barber-card">
  <input type="radio" name="barber" value="${escapeHtml(b.id)}"${(selectedBarberId ? b.id === selectedBarberId : i === 0) ? ' checked' : ''}>
  <span class="barber-top">
    ${barberPhotoImg(b)}
    <span style="min-width:0">
      <span class="barber-name">${escapeHtml(b.name)}</span>
      <span class="barber-meta" style="display:block"><span class="stars">★ ${b.rating.toFixed(1)}</span> · ${b.review_count} reviews${b.phone ? ` · ${escapeHtml(b.phone)}` : ''}</span>
    </span>
  </span>
</label>`,
    )
    .join('\n');

  const serviceCards = services
    .map(
      (s, i) => `<label class="service">
  <input type="radio" name="service" value="${escapeHtml(s.slug)}"${i === 0 ? ' checked' : ''}>
  <span class="svc-body">
    <span class="svc-main"><strong>${escapeHtml(s.name)}</strong><span class="dots" aria-hidden="true"></span><span class="p">${formatPrice(s)}</span></span>
    <span class="svc-sub"><span class="dur">${s.duration_minutes} MIN</span>${s.description ? ` · ${escapeHtml(s.description)}` : ''}</span>
  </span>
</label>`,
    )
    .join('\n');

  const dateBtns = dates
    .map((d, i) => {
      const p = dateChipParts(d);
      return `<button type="button" class="date-btn${i === 0 ? ' sel' : ''}" data-date="${escapeHtml(d)}"><small>${escapeHtml(p.dow)}</small><span class="dlabel">${escapeHtml(p.label)}</span></button>`;
    })
    .join('\n');

  const spotlightBarber = barbers.find((b) => b.id === selectedBarberId) ?? null;

  const body = `
${error ? `<div class="err" role="alert">${escapeHtml(error)}</div>` : ''}
<form id="bookform" method="POST" action="/api/book">
<section class="stage" aria-label="Step 1: barber">
  <div class="stage-head"><span class="stage-num" aria-hidden="true">01</span><h2>Barber</h2><span class="stage-rule" aria-hidden="true"></span></div>
  <div class="barber-grid" id="barberGrid" role="radiogroup" aria-label="Choose your barber">${barberCards}</div>
  <div id="barberSpotlight" class="barber-spotlight" aria-live="polite" aria-label="Selected barber details">${barberSpotlightHtml(spotlightBarber)}</div>
  <p class="hint">Hours and prices are each barber's own — pick the chair you want.</p>
</section>
<section class="stage" aria-label="Step 2: service">
  <div class="stage-head"><span class="stage-num" aria-hidden="true">02</span><h2>Service</h2><span class="stage-rule" aria-hidden="true"></span></div>
  <div id="services">${serviceCards || '<p class="hint">No services listed for this barber.</p>'}</div>
</section>
<section class="stage" aria-label="Step 3: day">
  <div class="stage-head"><span class="stage-num" aria-hidden="true">03</span><h2>Day</h2><span class="stage-rule" aria-hidden="true"></span></div>
  <div class="dates" id="dates">${dateBtns || '<p class="hint">No bookable days for this barber.</p>'}</div>
</section>
<section class="stage" aria-label="Step 4: time">
  <div class="stage-head"><span class="stage-num" aria-hidden="true">04</span><h2>Time</h2><span class="stage-rule" aria-hidden="true"></span></div>
  <div class="slots" id="slots" aria-live="polite"><p class="hint">Select a day to load times.</p></div>
  <input type="hidden" name="date" id="dateInput" value="${escapeHtml(dates[0] ?? '')}">
  <input type="hidden" name="slotStart" id="slotInput" value="">
</section>
<section class="stage" aria-label="Step 5: details">
  <div class="stage-head"><span class="stage-num" aria-hidden="true">05</span><h2>Details</h2><span class="stage-rule" aria-hidden="true"></span></div>
  <div class="field"><label for="name">Full name</label><input id="name" name="name" required maxlength="80" autocomplete="name"></div>
  <div class="field"><label for="phone">Phone (for reminders)</label><input id="phone" name="phone" required inputmode="tel" autocomplete="tel" placeholder="(415) 555-0100"></div>
  <div class="field"><label for="email">Email (for confirmation + reminders)</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com"></div>
  <div class="field"><label for="notes">Notes for your barber (optional)</label><textarea id="notes" name="notes" rows="2" maxlength="500"></textarea></div>
  <button class="btn" type="submit" id="submitBtn" disabled>Select a time to continue</button>
  <p class="hint">Demo only: submitting creates a record in the demo database. Email reminders are in demo mode until a mail key is configured.</p>
</section>
</form>
${shopInfoSections(barbers, hoursMap)}
<script>
var BARBER_DETAIL=${barberDetailPayload(barbers)};
var BARBER_PHOTO_FALLBACK=${JSON.stringify(PHOTO_FALLBACK)};
</script>
<script>
(function(){
  var barberGrid=document.getElementById('barberGrid'),servicesEl=document.getElementById('services'),
      datesEl=document.getElementById('dates'),slotsEl=document.getElementById('slots'),
      dateInput=document.getElementById('dateInput'),slotInput=document.getElementById('slotInput'),
      submitBtn=document.getElementById('submitBtn'),spotlightEl=document.getElementById('barberSpotlight');
  function selectedBarber(){var r=document.querySelector('input[name=barber]:checked');return r?r.value:'';}
  function selectedService(){var r=document.querySelector('input[name=service]:checked');return r?r.value:'';}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function detailFor(id){for(var i=0;i<BARBER_DETAIL.length;i++){if(BARBER_DETAIL[i].id===id)return BARBER_DETAIL[i];}return null;}
  /* Mirrors server barberSpotlightHtml(): selected barber's photo, name,
     Booksy aggregate rating, and work gallery. aria-live on the container
     announces the change to screen readers. */
  function spotlightHtml(b){
    if(!b)return '<div class="spotlight-empty"><p>Choose a barber to see their work.</p></div>';
    var gal=(b.gallery||[]).map(function(src,i){
      return '<img src="'+esc(src)+'" alt="Work example '+(i+1)+' by '+esc(b.name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=BARBER_PHOTO_FALLBACK">';
    }).join('\\n');
    return '<div class="spotlight-inner spotlight-enter">'
      +'<div class="spotlight-card">'
      +'<img class="spotlight-photo" src="'+esc(b.photo_url)+'" alt="Photo of '+esc(b.name)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=BARBER_PHOTO_FALLBACK">'
      +'<div class="spotlight-info"><h3>'+esc(b.name)+'</h3>'
      +'<p class="barber-meta"><span class="stars">★</span> '+Number(b.rating).toFixed(1)+' ('+b.review_count+' Booksy reviews)</p>'
      +'<p class="barber-booksy"><a href="'+esc(b.booksy_url)+'" target="_blank" rel="noopener">View '+esc(b.name)+' on Booksy</a></p>'
      +'</div></div>'
      +'<p class="spotlight-work-label">Their work</p>'
      +'<div class="spotlight-gallery">'+gal+'</div></div>';
  }
  function renderSpotlight(){spotlightEl.innerHTML=spotlightHtml(detailFor(selectedBarber()));}
  function priceHtml(cents){return cents==null?'<span class="tbd">TBD</span>':'$'+Math.round(cents/100);}
  function serviceCard(s,checked){
    return '<label class="service"><input type="radio" name="service" value="'+esc(s.slug)+'"'+(checked?' checked':'')+'>'
      +'<span class="svc-body"><span class="svc-main"><strong>'+esc(s.name)+'</strong>'
      +'<span class="dots" aria-hidden="true"></span><span class="p">'+priceHtml(s.price_cents)+'</span></span>'
      +'<span class="svc-sub"><span class="dur">'+s.duration_minutes+' MIN</span>'
      +(s.description?' · '+esc(s.description):'')+'</span></span></label>';
  }
  function loadSlots(){
    var barber=selectedBarber(),svc=selectedService(),date=dateInput.value;
    slotsEl.innerHTML='<p class="hint">Loading times…</p>';slotInput.value='';submitBtn.disabled=true;submitBtn.textContent='Select a time to continue';
    if(!barber||!svc||!date){slotsEl.innerHTML='<p class="hint">Pick a barber, service, and day.</p>';return;}
    fetch('/api/slots?barber='+encodeURIComponent(barber)+'&service='+encodeURIComponent(svc)+'&date='+encodeURIComponent(date))
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j.slots||!j.slots.length){slotsEl.innerHTML='<p class="hint">No times available this day. Try another.</p>';return;}
        slotsEl.innerHTML='';
        j.slots.forEach(function(s){
          var b=document.createElement('button');b.type='button';b.className='slot-btn';b.textContent=s.startLabel;b.dataset.ts=s.startTs;
          b.onclick=function(){
            slotsEl.querySelectorAll('.slot-btn').forEach(function(x){x.classList.remove('sel');});
            b.classList.add('sel');slotInput.value=b.dataset.ts;
            submitBtn.disabled=false;submitBtn.textContent='Book '+s.startLabel;
          };
          slotsEl.appendChild(b);
        });
      })
      .catch(function(){slotsEl.innerHTML='<p class="hint">Could not load times. Please retry.</p>';});
  }
  function loadServices(){
    var barber=selectedBarber();
    servicesEl.innerHTML='<p class="hint">Loading services…</p>';
    fetch('/api/services?barber='+encodeURIComponent(barber))
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j.services||!j.services.length){servicesEl.innerHTML='<p class="hint">No services listed for this barber.</p>';return;}
        servicesEl.innerHTML=j.services.map(function(s,i){return serviceCard(s,i===0);}).join('\\n');
        servicesEl.querySelectorAll('input[name=service]').forEach(function(r){r.addEventListener('change',loadSlots);});
        loadDates();
      })
      .catch(function(){servicesEl.innerHTML='<p class="hint">Could not load services. Please retry.</p>';});
  }
  function loadDates(){
    var barber=selectedBarber();
    datesEl.innerHTML='<p class="hint">Loading days…</p>';
    fetch('/api/dates?barber='+encodeURIComponent(barber))
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j.dates||!j.dates.length){datesEl.innerHTML='<p class="hint">No bookable days for this barber.</p>';dateInput.value='';loadSlots();return;}
        datesEl.innerHTML=j.dates.map(function(d,i){
          var dt=new Date(d+'T12:00:00Z');
          var dow=dt.toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',weekday:'short'});
          var label=dt.toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric'});
          return '<button type="button" class="date-btn'+(i===0?' sel':'')+'" data-date="'+esc(d)+'"><small>'+esc(dow)+'</small><span class="dlabel">'+esc(label)+'</span></button>';
        }).join('\\n');
        dateInput.value=j.dates[0];
        loadSlots();
      })
      .catch(function(){datesEl.innerHTML='<p class="hint">Could not load days. Please retry.</p>';});
  }
  barberGrid.addEventListener('change',function(){renderSpotlight();loadServices();});
  datesEl.addEventListener('click',function(e){
    var b=e.target.closest('.date-btn');if(!b)return;
    datesEl.querySelectorAll('.date-btn').forEach(function(x){x.classList.remove('sel');});
    b.classList.add('sel');dateInput.value=b.dataset.date;loadSlots();
  });
  servicesEl.querySelectorAll('input[name=service]').forEach(function(r){r.addEventListener('change',loadSlots);});
  loadSlots();
})();
</script>`;
  return layout('Book an appointment', body);
}

export function confirmationPage(
  booking: Booking,
  serviceName: string,
  serviceSlug: string,
  dates: string[],
  whenLabel: string,
  emailNote: string,
  barber: Barber | null,
): string {
  const minDate = dates[0] ?? '';
  const maxDate = dates[dates.length - 1] ?? '';
  const barberRow = barber
    ? `<div class="ticket-barber">${barberPhotoImg(barber)}<div><strong>${escapeHtml(barber.name)}</strong><br><span class="hint">★ ${barber.rating.toFixed(1)} · ${barber.review_count} Booksy reviews</span></div></div>`
    : '';
  const body = `
<div class="ticket">
  <div class="ticket-head"><div class="k">Appointment ticket</div><h2>You are booked</h2></div>
  <div class="ticket-body">
    <div class="ref">${escapeHtml(booking.id)}</div>
    ${barberRow}
    <table class="ticket-table">
      <tr><th>Service</th><td>${escapeHtml(serviceName)}</td></tr>
      <tr><th>Barber</th><td>${escapeHtml(barber?.name ?? booking.barber)}</td></tr>
      <tr><th>When</th><td>${escapeHtml(whenLabel)}</td></tr>
      <tr><th>Name</th><td>${escapeHtml(booking.guest_name)}</td></tr>
      <tr><th>Phone</th><td>${escapeHtml(booking.guest_phone)}</td></tr>
      ${booking.guest_email ? `<tr><th>Email</th><td>${escapeHtml(booking.guest_email)}</td></tr>` : ''}
    </table>
    <p class="hint">${escapeHtml(emailNote)}</p>
  </div>
  <div class="ticket-foot">
    <a class="btn secondary" href="/" style="text-align:center">Book another appointment</a>
    <form method="POST" action="/book/${escapeHtml(booking.id)}/cancel" onsubmit="return confirm('Cancel booking ${escapeHtml(booking.id)}?')">
      <button class="btn secondary" type="submit" style="border-color:var(--color-danger);color:var(--color-danger-ink)">Cancel this booking</button>
    </form>
  </div>
</div>
<section class="section" aria-label="Reschedule">
  <div class="section-head"><span class="kicker">Change of plans</span><h2>Reschedule</h2><span class="rule" aria-hidden="true"></span></div>
  <form id="resched" method="POST" action="/book/${escapeHtml(booking.id)}/reschedule">
    <div class="field"><label for="rdate">New day</label>
      <input id="rdate" name="date" type="date" required min="${escapeHtml(minDate)}" max="${escapeHtml(maxDate)}" value="${escapeHtml(minDate)}">
    </div>
    <div class="field"><label for="rslot">New time</label>
      <select id="rslot" name="slotStart" required><option value="">Pick a day first</option></select>
    </div>
    <button class="btn" type="submit" id="rbtn" disabled>Pick a time to reschedule</button>
    <p class="hint">Rescheduling moves your booking atomically — the new slot is only taken if it is still free.</p>
  </form>
</section>
<script>
(function(){
  var d=document.getElementById('rdate'),s=document.getElementById('rslot'),b=document.getElementById('rbtn');
  var svc=${JSON.stringify(serviceSlug)};
  var barber=${JSON.stringify(barber?.id ?? '')};
  function load(){
    if(!d.value){s.innerHTML='<option value="">Pick a day first</option>';b.disabled=true;return;}
    s.innerHTML='<option value="">Loading times…</option>';b.disabled=true;
    fetch('/api/slots?barber='+encodeURIComponent(barber)+'&service='+encodeURIComponent(svc)+'&date='+encodeURIComponent(d.value))
      .then(function(r){return r.json();})
      .then(function(j){
        s.innerHTML='';
        if(!j.slots||!j.slots.length){s.innerHTML='<option value="">No times available</option>';return;}
        j.slots.forEach(function(x){
          var o=document.createElement('option');o.value=x.startTs;o.textContent=x.startLabel;s.appendChild(o);
        });
        b.disabled=false;b.textContent='Reschedule to '+s.options[0].textContent;
      })
      .catch(function(){s.innerHTML='<option value="">Could not load times</option>';});
  }
  d.addEventListener('change',load);
  s.addEventListener('change',function(){b.textContent='Reschedule to '+s.options[s.selectedIndex].textContent;});
  load();
})();
</script>`;
  return layout('Booking confirmed', body);
}

export function cancelledPage(id: string): string {
  return layout('Booking cancelled', `<div class="ok" role="status">Booking <strong class="mono">${escapeHtml(id)}</strong> is cancelled.</div>
  <a class="btn" href="/" style="text-align:center">Book a new appointment</a>`);
}

export function errorPage(title: string, message: string): string {
  return layout(title, `<div class="err" role="alert">${escapeHtml(message)}</div>
  <a class="btn secondary" href="/" style="text-align:center">Back to booking</a>`);
}

export function adminPage(
  bookings: (Booking & { service_name: string; barber_name: string })[],
  barbers: Barber[],
  selectedBarber: string,
): string {
  const rows = bookings
    .map((b) => {
      const when = new Date(b.start_ts).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      return `<tr>
  <td><strong class="mono">${escapeHtml(b.id)}</strong><br><span class="hint">${escapeHtml(when)}</span></td>
  <td>${escapeHtml(b.service_name ?? b.service_id)}<br><span class="hint">${escapeHtml(b.barber_name ?? b.barber)}</span></td>
  <td>${escapeHtml(b.guest_name)}<br><span class="hint">${escapeHtml(b.guest_phone)}${b.guest_email ? '<br>' + escapeHtml(b.guest_email) : ''}</span></td>
  <td><form method="POST" action="/admin/cancel" onsubmit="return confirm('Cancel booking ${escapeHtml(b.id)}?')">
    <input type="hidden" name="id" value="${escapeHtml(b.id)}">
    <button class="btn secondary" type="submit" style="padding:10px 14px;font-size:13px;min-height:44px">Cancel</button>
  </form></td>
</tr>`;
    })
    .join('\n');
  const filterOptions = barbers
    .map((b) => `<option value="${escapeHtml(b.id)}"${b.id === selectedBarber ? ' selected' : ''}>${escapeHtml(b.name)}</option>`)
    .join('\n');
  const body = `<section class="section" aria-label="Admin">
  <div class="section-head"><span class="kicker">Admin</span><h2>Upcoming bookings (${bookings.length})</h2><span class="rule" aria-hidden="true"></span></div>
  <p class="hint">Demo admin: protected by HTTP Basic auth (demo-grade). <a href="/admin/config">Configure services &amp; hours</a></p>
  <form method="GET" action="/admin" style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
    <label for="barberFilter" style="font-size:13px">Barber</label>
    <select name="barber" id="barberFilter" onchange="this.form.submit()" style="width:auto">
      <option value="">All barbers</option>
      ${filterOptions}
    </select>
    ${selectedBarber ? '<a href="/admin" style="font-size:13px">Clear</a>' : ''}
  </form>
  ${bookings.length ? `<table class="ledger"><tr><th>Booking</th><th>Service</th><th>Guest</th><th></th></tr>${rows}</table>` : '<p class="hint">No upcoming bookings.</p>'}
  </section>`;
  return layout('Admin', body);
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function adminConfigPage(
  services: Service[],
  barbers: Barber[],
  hoursMap: Map<string, DayWindow[]>,
  notice?: string,
): string {
  const svcRow = (s: Service) => `<tr>
  <td><strong>${escapeHtml(s.name)}</strong><br><span class="hint mono">${escapeHtml(s.slug)}</span></td>
  <td><input type="number" name="svc_${escapeHtml(s.id)}_duration" value="${s.duration_minutes}" min="5" max="480" step="5" required aria-label="Duration minutes for ${escapeHtml(s.name)}"></td>
  <td><input type="number" name="svc_${escapeHtml(s.id)}_price" value="${s.price_cents == null ? '' : s.price_cents / 100}" min="0" max="100000" step="1" placeholder="TBD" aria-label="Price dollars for ${escapeHtml(s.name)}"></td>
  <td><input type="checkbox" name="svc_${escapeHtml(s.id)}_active" ${s.is_active ? 'checked' : ''} aria-label="Active: ${escapeHtml(s.name)}"></td>
</tr>`;
  const svcSections = barbers
    .map((b) => {
      const rows = services
        .filter((s) => s.barber_id === b.id)
        .map(svcRow)
        .join('\n');
      return `<h3 style="display:flex;align-items:center;gap:10px">${barberPhotoImg(b)} ${escapeHtml(b.name)}</h3>
      ${rows ? `<table class="ledger"><tr><th>Service</th><th>Minutes</th><th>Price $ (blank = TBD)</th><th>Active</th></tr>${rows}</table>` : '<p class="hint">No services for this barber.</p>'}`;
    })
    .join('\n');
  const windowText = (windows: DayWindow[], dow: number): string =>
    windows
      .filter((w) => w.day_of_week === dow)
      .map((w) => `${w.open_time}-${w.close_time}`)
      .join(', ');
  const hourSections = barbers
    .map((b) => {
      const windows = hoursMap.get(b.id) ?? [];
      const rows = [0, 1, 2, 3, 4, 5, 6]
        .map(
          (dow) => `<tr>
  <td>${DOW_NAMES[dow]}</td>
  <td><input type="text" name="bh_${escapeHtml(b.id)}_${dow}" value="${escapeHtml(windowText(windows, dow))}" placeholder="Closed" pattern="[0-9:, \\-]*" aria-label="Hours for ${escapeHtml(b.name)} on ${DOW_NAMES[dow]} (HH:MM-HH:MM, comma-separated; blank = closed)"></td>
</tr>`,
        )
        .join('\n');
      return `<h3 style="display:flex;align-items:center;gap:10px">${barberPhotoImg(b)} ${escapeHtml(b.name)}</h3>
      <table class="ledger"><tr><th>Day</th><th>Windows (HH:MM-HH:MM, comma-separated; blank = closed)</th></tr>${rows}</table>`;
    })
    .join('\n');
  const body = `<section class="section" aria-label="Admin configuration">
  <div class="section-head"><span class="kicker">Admin</span><h2>Services &amp; barber hours</h2><span class="rule" aria-hidden="true"></span></div>
  <p class="hint"><a href="/admin">Back to bookings</a></p>
  ${notice ? `<div class="ok" role="status">${escapeHtml(notice)}</div>` : ''}
  <form method="POST" action="/admin/config/services">
    <h3>Services</h3>
    ${svcSections}
    <button class="btn" type="submit">Save services</button>
  </form>
  <form method="POST" action="/admin/config/hours" style="margin-top:2rem">
    <h3>Barber hours (America/Los_Angeles) — a blank day is closed</h3>
    ${hourSections}
    <button class="btn" type="submit">Save hours</button>
  </form>
  </section>`;
  return layout('Admin: configuration', body);
}
