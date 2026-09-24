// Tests for the selected-barber spotlight panel in the booking flow.
// The panel below the barber picker must re-render on every selection change
// with THAT barber's photo, name, Booksy aggregate rating, and work gallery.
import { describe, expect, it } from 'vitest';
import { parseBarber } from './db';
import { barberDetailPayload, barberSpotlightHtml, bookingPage } from './templates/pages';
import type { Barber } from './types';

const JESSE_GAL = [
  'https://cdn.example.com/jesse/work1.jpeg',
  'https://cdn.example.com/jesse/work2.jpeg',
  'https://cdn.example.com/jesse/work3.jpeg',
];
const TEMUR_GAL = ['https://cdn.example.com/temur/work1.jpeg'];
const JUAN_GAL = [
  'https://cdn.example.com/juan/work1.jpeg',
  'https://cdn.example.com/juan/work2.jpeg',
];
const RJ_GAL: string[] = [];

function barber(id: string, name: string, review_count: number, gallery: string[]): Barber {
  return {
    id,
    name,
    photo_url: `https://cdn.example.com/${id}/photo.jpeg`,
    booksy_url: `https://booksy.com/${id}`,
    phone: null,
    rating: 5.0,
    review_count,
    notes: null,
    is_active: 1,
    sort_order: 0,
    gallery_images: gallery,
  };
}

const BARBERS: Barber[] = [
  barber('jesse', 'Jesse Marquez', 37, JESSE_GAL),
  barber('temur', 'Temur Gold', 125, TEMUR_GAL),
  barber('juan', 'Juan Murillo', 61, JUAN_GAL),
  barber('rj', 'RJ (itsrjstyles)', 96, RJ_GAL),
];

describe('parseBarber gallery_images', () => {
  const base = { id: 'juan', name: 'Juan Murillo', photo_url: 'p', booksy_url: 'u', phone: null, rating: 5.0, review_count: 61, notes: null, is_active: 1, sort_order: 3 };

  it('parses a valid JSON array of URLs', () => {
    const b = parseBarber({ ...base, gallery_images: JSON.stringify(JUAN_GAL) });
    expect(b.gallery_images).toEqual(JUAN_GAL);
  });

  it('returns [] for malformed JSON instead of throwing', () => {
    const b = parseBarber({ ...base, gallery_images: 'not-json[[' });
    expect(b.gallery_images).toEqual([]);
  });

  it('returns [] when the column is absent (pre-0004 database)', () => {
    const b = parseBarber({ ...base });
    expect(b.gallery_images).toEqual([]);
  });

  it('drops non-string entries from the array', () => {
    const b = parseBarber({ ...base, gallery_images: '["https://a/", 42, null, "https://b/"]' });
    expect(b.gallery_images).toEqual(['https://a/', 'https://b/']);
  });
});

describe('barberSpotlightHtml', () => {
  it('renders photo, name, aggregate rating, gallery, and Booksy link for the given barber', () => {
    const html = barberSpotlightHtml(BARBERS[2]);
    expect(html).toContain('alt="Photo of Juan Murillo"');
    expect(html).toContain('Juan Murillo');
    expect(html).toContain('(61 Booksy reviews)');
    expect(html).toContain(JUAN_GAL[0]);
    expect(html).toContain(JUAN_GAL[1]);
    expect(html).toContain('https://booksy.com/juan');
    // No invented review text: the panel must not contain a blockquote
    expect(html).not.toContain('<blockquote>');
  });

  it('renders a neutral prompt when no barber is selected', () => {
    const html = barberSpotlightHtml(null);
    expect(html).toContain('Choose a barber to see their work.');
    expect(html).not.toContain('spotlight-card');
  });
});

describe('bookingPage spotlight wiring', () => {
  it('renders the selected barber in the spotlight, not the first barber', () => {
    const html = bookingPage(BARBERS, 'juan', [], [], new Map());
    expect(html).toContain('id="barberSpotlight"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('alt="Photo of Juan Murillo"');
    expect(html).toContain(JUAN_GAL[0]);
    // Jesse's gallery must NOT leak into the spotlight panel when Juan is
    // selected (it legitimately lives in the BARBER_DETAIL payload for the
    // client re-render — scoped check on the panel markup only)
    const panel = html.slice(html.indexOf('id="barberSpotlight"'), html.indexOf('<p class="hint">Hours and prices'));
    for (const u of JESSE_GAL) expect(panel).not.toContain(u);
    expect(panel).toContain(JUAN_GAL[0]);
  });

  it('shows the empty-state prompt when no barber is selected', () => {
    const html = bookingPage(BARBERS, '', [], [], new Map());
    expect(html).toContain('Choose a barber to see their work.');
  });

  it('embeds the per-barber detail payload for instant client re-render', () => {
    const payload = JSON.parse(barberDetailPayload(BARBERS));
    expect(payload).toHaveLength(4);
    const juan = payload.find((p: { id: string }) => p.id === 'juan');
    expect(juan.gallery).toEqual(JUAN_GAL);
    expect(juan.name).toBe('Juan Murillo');
    const html = bookingPage(BARBERS, 'jesse', [], [], new Map());
    expect(html).toContain('var BARBER_DETAIL=');
    expect(html).toContain('renderSpotlight');
  });
});
