-- Closer Shave booking demo — barber + service seed (IDEMPOTENT).
-- Run with: wrangler d1 execute --remote --config ./wrangler.toml --file=seeds/barbers.sql
-- NOT a migration: safe to re-run; it fully replaces barbers, hours, services.
--
-- SOURCES (extracted live from Booksy provider listings 2026-09-24):
--   Jesse Marquez:      https://booksy.com/en-us/1714670_jesse_barber-shop_134715_san-francisco
--   Temurgoldclub:       https://booksy.com/en-us/575950_temurgoldclub-barbershop_barber-shop_134715_san-francisco
--   Your Barber Juan:    https://booksy.com/en-us/1710466_your-barber-juan_barber-shop_134715_san-francisco
--   Itsrjstyles (RJ):    https://booksy.com/en-us/1150634_itsrjstyles_barber-shop_134715_san-francisco
-- Shop: The Closer Shave, 411A Brannan St, San Francisco, CA 94107 — 5.0 (319).
-- Shop hours (display only): Sun 11:00-18:00; Mon closed; Tue 14:00-18:00;
-- Wed 11:00-19:30; Thu 14:00-20:00; Fri 10:30-20:00; Sat 11:00-18:00.

DELETE FROM barber_hours;

-- Upsert barbers (migration 0003 pre-inserted placeholder rows; re-running is safe).
-- gallery_images: Booksy portfolio ("inspiration") images, captured 2026-09-24.
INSERT INTO barbers (id, name, photo_url, booksy_url, phone, rating, review_count, notes, is_active, sort_order, gallery_images) VALUES
('jesse',
 'Jesse Marquez',
 'https://d2zdpiztbgorvt.cloudfront.net/region1/us/1714670/biz_photo/810add172ab846ab8303ecdc5e2fd9-jesse-biz-photo-5a709c5cc9724cb2a6c61b161ffe2f-booksy.jpeg',
 'https://booksy.com/en-us/1714670_jesse_barber-shop_134715_san-francisco',
 '(925) 517-5290',
 5.0, 37, NULL, 1, 1,
 '["https://d2zdpiztbgorvt.cloudfront.net/region1/us/1714670/inspiration/aabcb845c8904668b9b96ac624e954-jesse-inspiration-ea61e6a903e545c78a1c177de45718-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1714670/inspiration/1b8cb1d7de9443aeae187f246365f4-jesse-inspiration-1e67d543a8f44379887787d6fcde49-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1714670/inspiration/31a94d48ce3d405889a88da7cb2caf-jesse-inspiration-e5bda070489746338a71e527e6fe8c-booksy.jpeg?size=360x360"]'),
('temur',
 'Temur Gold',
 'https://d2zdpiztbgorvt.cloudfront.net/region1/us/575950/biz_photo/b054210901864806b5252ff40df54c-temurgoldclub-barbershop-biz-photo-a3d061bf12d24d23beec249a86e1cd-booksy.jpeg',
 'https://booksy.com/en-us/575950_temurgoldclub-barbershop_barber-shop_134715_san-francisco',
 '(415) 465-5915',
 5.0, 125, 'Child-friendly · pets allowed · Wi-Fi', 1, 2,
 '["https://d2zdpiztbgorvt.cloudfront.net/region1/us/575950/inspiration/0e7e80caf07849eaa793fa725e063f-temurgoldclub-barbershop-inspiration-a559cd4a09814862849842a5c942e687052eb9c71167-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/575950/inspiration/508912db0d6144caab941ae20a47d5-temurgoldclub-barbershop-inspiration-49b704d9aa7242e687052eb9c71167-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/575950/inspiration/250c759f6f8f488391aca4ec66c646-temurgoldclub-barbershop-inspiration-701e29c69c24492e827091273a6fcde49-booksy.jpeg?size=360x360"]'),
('juan',
 'Juan Murillo',
 'https://d2zdpiztbgorvt.cloudfront.net/region1/us/1710466/biz_photo/a1dc378372114c75b7259cf8f1d218-your-barber-juan-biz-photo-c11c87168fd240bea89fff716d24e3-booksy.jpeg',
 'https://booksy.com/en-us/1710466_your-barber-juan_barber-shop_134715_san-francisco',
 '(415) 629-5395',
 5.0, 61, 'Booksy: Your Barber Juan', 1, 3,
 '["https://d2zdpiztbgorvt.cloudfront.net/region1/us/1710466/inspiration/8f3684d97cee4ac69eff1969e8a4ef-your-barber-juan-inspiration-645d06e661244f508782212a4d41ac-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1710466/inspiration/eac3d5e541b6435ca1287edf2a31b5-your-barber-juan-inspiration-34ff32a00d354b7daf186daf1fb62f-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1710466/inspiration/b79ecfcded18407fb5a73139ffd6c9-your-barber-juan-inspiration-54be3ae7536442ed998b32e954e2cb-booksy.jpeg?size=360x360"]'),
('rj',
 'RJ (itsrjstyles)',
 'https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/biz_photo/03ecfaee67954b75be46356faece14-itsrjstyles-biz-photo-71b76fed5ae84af1acc3900904a0df-booksy.jpeg',
 'https://booksy.com/en-us/1150634_itsrjstyles_barber-shop_134715_san-francisco',
 '(415) 965-5951',
 5.0, 96, 'Second floor at 411A Brannan', 1, 4,
 '["https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/1d10c08414ed471183b02bcb96b5ad-itsrjstyles-inspiration-d67b6bda229744e392a2cb499e6783-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/98ee272139164319b873565d323186-itsrjstyles-inspiration-c5b745db44c648f1b33dcef2bbbc85-booksy.jpeg?size=360x360","https://d2zdpiztbgorvt.cloudfront.net/region1/us/1150634/inspiration/9346377235144f4da73d2329d5233d-itsrjstyles-inspiration-fffab52c23664b8d95a76511d6a3a8-booksy.jpeg?size=360x360"]')
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  photo_url = excluded.photo_url,
  booksy_url = excluded.booksy_url,
  phone = excluded.phone,
  rating = excluded.rating,
  review_count = excluded.review_count,
  notes = excluded.notes,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  gallery_images = excluded.gallery_images;

-- Per-barber weekly hours. A missing weekday = closed.
-- day_of_week: 0=Sun … 6=Sat. window_index orders split shifts (Juan, Monday).
INSERT INTO barber_hours (barber_id, day_of_week, window_index, open_time, close_time) VALUES
-- Jesse: Sun closed; Tue 12:00-19:00; Thu 10:00-19:00; Sat 10:00-15:00
('jesse', 2, 0, '12:00', '19:00'),
('jesse', 4, 0, '10:00', '19:00'),
('jesse', 6, 0, '10:00', '15:00'),
-- Temur: Sun closed; Tue 14:00-19:00; Thu 14:00-20:00; Sat 10:00-15:30
('temur', 2, 0, '14:00', '19:00'),
('temur', 4, 0, '14:00', '20:00'),
('temur', 6, 0, '10:00', '15:30'),
-- Juan: Sun closed; Mon 12:00-17:15 AND 17:45-21:00 (split shift);
-- Wed 15:00-21:00; Fri 12:00-18:00
('juan', 1, 0, '12:00', '17:15'),
('juan', 1, 1, '17:45', '21:00'),
('juan', 3, 0, '15:00', '21:00'),
('juan', 5, 0, '12:00', '18:00'),
-- RJ: Sun 12:00-17:00; Mon closed; Tue 12:00-20:00; Thu 12:00-20:30
('rj', 0, 0, '12:00', '17:00'),
('rj', 2, 0, '12:00', '20:00'),
('rj', 4, 0, '12:00', '20:30');

-- Legacy single-barber services (barber_id NULL) are retired but kept for any
-- old booking rows that reference them; bookings never delete services now.
UPDATE services SET is_active = 0 WHERE barber_id IS NULL;

-- Services, one row per barber. Slugs are globally unique (barber-prefixed).
-- Upsert: safe to re-run; each row keeps its stable id.
INSERT INTO services (id, slug, name, description, duration_minutes, price_cents, price_note, barber_id, is_active, sort_order) VALUES
-- Jesse Marquez
('jesse_haircut', 'jesse-haircut', 'Haircut', 'Precision haircut.', 45, 7000, NULL, 'jesse', 1, 1),
('jesse_haircut_beard', 'jesse-haircut-beard', 'Haircut + Beard Trim', 'Haircut with a beard trim finish.', 75, 10000, NULL, 'jesse', 1, 2),
('jesse_beard', 'jesse-beard', 'Beard Trim', 'Beard shaping and cleanup.', 30, 4000, NULL, 'jesse', 1, 3),
('jesse_lineup', 'jesse-razor-lineup', 'Razor Line Up / Shave', 'Crisp razor line up.', 30, 6000, NULL, 'jesse', 1, 4),
('jesse_haircut_shave', 'jesse-haircut-shave', 'Haircut + Shave', 'Haircut with a full shave.', 90, 12000, NULL, 'jesse', 1, 5),
-- Temur Gold
('temur_haircut', 'temur-haircut', 'Haircut', 'Signature haircut.', 30, 7500, NULL, 'temur', 1, 1),
('temur_haircut_beard', 'temur-haircut-beard', 'Haircut with Beard Trim', 'Haircut plus beard trim.', 60, 10000, NULL, 'temur', 1, 2),
('temur_beard', 'temur-beard', 'Beard Trim', 'Beard trim and shaping.', 30, 4500, NULL, 'temur', 1, 3),
('temur_haircut_wash', 'temur-haircut-wash', 'Haircut with Wash', 'Haircut with shampoo and conditioner wash.', 45, 8500, NULL, 'temur', 1, 4),
('temur_house_call', 'temur-house-call', 'House Call', 'Barber comes to you.', 5, 18000, NULL, 'temur', 1, 5),
('temur_hot_towel', 'temur-hot-towel-shave', 'Premium Hot Towel Shave', 'Hot towel straight-razor shave.', 30, 5000, NULL, 'temur', 1, 6),
-- Juan Murillo (loyalty prices noted from Booksy)
('juan_haircut', 'juan-haircut', 'Haircut', 'Haircut, 45 minutes. Loyalty price $63.70 for returning clients.', 45, 7000, NULL, 'juan', 1, 1),
('juan_haircut_beard', 'juan-haircut-beard', 'Haircut and Beard', 'Haircut plus beard, 1h15. Loyalty price $91 for returning clients.', 75, 10000, NULL, 'juan', 1, 2),
('juan_beard', 'juan-beard', 'Beard', 'Beard service, 30 minutes. Loyalty price $40.95 for returning clients.', 30, 4500, NULL, 'juan', 1, 3),
('juan_buzzcut', 'juan-buzzcut', 'Buzzcut', 'Buzz cut (listed under Other Services on Booksy).', 30, NULL, 'Price on Booksy', 'juan', 1, 4),
-- RJ (itsrjstyles)
('rj_haircut', 'rj-haircut', 'Haircut (Scissors/Clippers)', 'Haircut with scissors on top and clippers on the side.', 30, 7900, NULL, 'rj', 1, 1),
('rj_clipper', 'rj-clipper-cut', 'Clipper Cut', 'Buzz cut with fade or even cut all around using only clippers.', 30, 7000, NULL, 'rj', 1, 2),
('rj_haircut_beard', 'rj-haircut-beard', 'Haircut and Beard Trim with Razor Line Up', 'Haircut with a beard trim and razor line up finish.', 60, 9700, NULL, 'rj', 1, 3),
('rj_haircut_wash', 'rj-haircut-wash', 'Haircut with Wash', 'Haircut including hair washing service with shampoo and conditioner.', 45, 9000, NULL, 'rj', 1, 4),
('rj_haircut_facial', 'rj-haircut-facial', 'Haircut Facial and Wash', 'Haircut with steamer, hot towel, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 14500, NULL, 'rj', 1, 5),
('rj_clipper_wash', 'rj-clipper-wash', 'Clipper Cut with Wash', 'Clipper cut with hair washing service.', 45, 8100, NULL, 'rj', 1, 6),
('rj_clipper_facial', 'rj-clipper-facial', 'Clipper Cut / Facial Combo / Wash', 'Clipper cut with steamer, hot towel, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 13600, NULL, 'rj', 1, 7),
('rj_long', 'rj-long-haircut', 'Men''s Long Haircut', 'Majority scissor work with minor clipper work for a more natural look.', 30, 8800, NULL, 'rj', 1, 8),
('rj_long_wash', 'rj-long-wash', 'Men''s Long Hair Cut with Wash', 'Men''s long hair cut with hair washing service.', 45, 9900, NULL, 'rj', 1, 9),
('rj_long_facial', 'rj-long-facial', 'Men''s Long Haircut with Facial and Wash', 'Men''s long haircut with steamer, hot towel, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 15400, NULL, 'rj', 1, 10),
('rj_haircut_beard_wash', 'rj-haircut-beard-wash', 'Haircut Beard Trim with Razor Line Up and Wash', 'Haircut and beard trim with razor line up, hot towel and wash service.', 60, 10600, NULL, 'rj', 1, 11),
('rj_clipper_beard', 'rj-clipper-beard', 'Clipper Cut and Beard Trim with Razor Line Up', 'Clipper cut with beard trim and razor line up.', 60, 8800, NULL, 'rj', 1, 12),
('rj_clipper_beard_wash', 'rj-clipper-beard-wash', 'Clipper Cut and Beard Trim with Razor Line / Wash', 'Clipper cut with beard trim and razor line up, finished with hot towel and wash.', 60, 9900, NULL, 'rj', 1, 13),
('rj_haircut_shave', 'rj-haircut-shave', 'Haircut and Straight Razor Shave with Hot Towel', 'Haircut and full straight razor shave for a cleaner look.', 60, 11500, NULL, 'rj', 1, 14),
('rj_haircut_shave_wash', 'rj-haircut-shave-wash', 'Haircut and Straight Razor Shave / Wash', 'Haircut and wash with straight razor shave and hot towel finish.', 60, 12600, NULL, 'rj', 1, 15),
('rj_haircut_beard_facial', 'rj-haircut-beard-facial', 'Haircut Facial Beard Trim Razor Line Up / Wash Combo', 'Haircut, beard trim, and razor line up, followed by steamer, hot towel, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 90, 16300, NULL, 'rj', 1, 16),
('rj_haircut_shave_facial', 'rj-haircut-shave-facial', 'Haircut and Straight Razor Shave with Facial / Wash', 'Haircut with a straight razor face shave, steamer, hot towel, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 90, 18100, NULL, 'rj', 1, 17),
('rj_beard', 'rj-beard', 'Beard Trim with Razor Line Up', 'Shaping of the beard with trimmers and clippers, finished off with a razor line up.', 30, 5200, NULL, 'rj', 1, 18),
('rj_beard_facial', 'rj-beard-facial', 'Beard Trim & Razor Line Up / Facial Combo', 'Beard trim and razor line up with steamer, hot towel, Korean mask, cleanser, and moisturizer.', 45, 10700, NULL, 'rj', 1, 19),
('rj_shave', 'rj-shave', 'Straight Razor Shave', 'A shave with a single edge blade, finished with a hot towel and aftershave.', 30, 6100, NULL, 'rj', 1, 20),
('rj_shave_facial', 'rj-shave-facial', 'Straight Razor Shave / Facial Combo', 'Straight razor face shave with steamer, hot towel, Korean mask, cleanser, and moisturizer.', 45, 11600, NULL, 'rj', 1, 21)
ON CONFLICT (id) DO UPDATE SET
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  price_note = excluded.price_note,
  barber_id = excluded.barber_id,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
