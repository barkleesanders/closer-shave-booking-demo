-- Closer Shave booking demo - seed data
-- SOURCES (fetched live 2026-09-24):
--   Services + prices + durations: Booksy provider listing "Itsrjstyles"
--   https://booksy.com/en-us/1150634_itsrjstyles_barber-shop_134715_san-francisco
--   Shop hours: Booksy shop listing "The Closer Shave" (canonical)
--   https://booksy.com/en-us/1150636_the-closer-shave_barber-shop_134715_san-francisco
--   Sun 11:00-18:00, Mon closed, Tue 14:00-18:00, Wed 11:00-19:30,
--   Thu 14:00-20:00, Fri 10:30-20:00, Sat 11:00-18:00.

INSERT INTO services (id, slug, name, description, duration_minutes, price_cents, price_note, sort_order) VALUES
('svc_haircut', 'haircut', 'Haircut', 'Haircut with scissors on top and clippers on the side.', 30, 7900, NULL, 1),
('svc_clipper', 'clipper-cut', 'Clipper Cut', 'Buzz cut with fade or even cut all around using only clippers.', 30, 7000, NULL, 2),
('svc_beard', 'beard-trim-razor-lineup', 'Beard Trim with Razor Line Up', 'Shaping of the beard with trimmers and clippers, finished off with a razor line up.', 30, 5200, NULL, 3),
('svc_shave', 'straight-razor-shave', 'Straight Razor Shave', 'A shave performed with a single edge blade for a cleaner, smooth look, finished with a hot towel and aftershave.', 30, 6100, NULL, 4),
('svc_haircut_wash', 'haircut-wash', 'Haircut with Wash', 'Haircut including hair washing service with shampoo and conditioner.', 30, 9000, NULL, 5),
('svc_long', 'mens-long-haircut', 'Men''s Long Haircut', 'Majority scissor work with minor clipper work for a more natural look.', 30, 8800, NULL, 6),
('svc_clipper_wash', 'clipper-cut-wash', 'Clipper Cut with Wash', 'Clipper cut sides and back with hair washing service.', 30, 8100, NULL, 7),
('svc_long_wash', 'mens-long-haircut-wash', 'Men''s Long Haircut with Wash', 'Men''s long hair cut with hair washing service.', 30, 9900, NULL, 8),
('svc_beard_facial', 'beard-trim-facial-combo', 'Beard Trim & Razor Line Up / Facial Combo', 'Beard trim and razor line-up with a steamer, hot towel treatment, Korean mask, cleanser, finished with moisturizer.', 45, 10700, NULL, 9),
('svc_shave_facial', 'straight-razor-shave-facial', 'Straight Razor Shave / Facial Combo', 'Straight razor face shave with steamer, hot towel treatment, Korean mask, cleanser, finished with moisturizer.', 45, 11600, NULL, 10),
('svc_haircut_beard', 'haircut-beard-trim', 'Haircut and Beard Trim with Razor Line Up', 'Haircut done with clippers or clippers and scissors with a beard trim / razor line up finish.', 60, 9700, NULL, 11),
('svc_haircut_facial', 'haircut-facial-wash', 'Haircut Facial and Wash', 'Haircut with a steamer, hot towel treatment, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 14500, NULL, 12),
('svc_clipper_facial', 'clipper-cut-facial-wash', 'Clipper Cut / Facial Combo / Wash', 'Clipper cut with a steamer, hot towel treatment, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 13600, NULL, 13),
('svc_long_facial', 'mens-long-haircut-facial-wash', 'Men''s Long Haircut with Facial and Wash', 'Men''s long haircut with a steamer, hot towel treatment, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 60, 15400, NULL, 14),
('svc_haircut_beard_wash', 'haircut-beard-trim-wash', 'Haircut Beard Trim with Razor Line Up and Wash', 'Haircut and beard trim with razor line up, hot towel and wash service at the end.', 60, 10600, NULL, 15),
('svc_clipper_beard', 'clipper-cut-beard-trim', 'Clipper Cut and Beard Trim with Razor Line Up', 'Clipper cut with beard trim and razor line. Fade on the sides or buzz on top with fade on the sides.', 60, 8800, NULL, 16),
('svc_clipper_beard_wash', 'clipper-cut-beard-trim-wash', 'Clipper Cut and Beard Trim with Razor Line / Wash', 'Clipper cut sides and back with beard trim and razor line up, finished with hot towel and wash service.', 60, 9900, NULL, 17),
('svc_haircut_shave', 'haircut-straight-razor-shave', 'Haircut and Straight Razor Shave with Hot Towel', 'Haircut and full straight razor shave for a cleaner look.', 60, 11500, NULL, 18),
('svc_haircut_shave_wash', 'haircut-straight-razor-shave-wash', 'Haircut and Straight Razor Shave / Wash', 'Haircut and wash with straight razor shave and hot towel finish.', 60, 12600, NULL, 19),
('svc_haircut_beard_facial', 'haircut-beard-facial-combo', 'Haircut Facial Beard Trim Razor Line Up / Wash Combo', 'Haircut, beard trim, and razor line-up, followed by a steamer, hot towel treatment, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 90, 16300, NULL, 20),
('svc_haircut_shave_facial', 'haircut-shave-facial-wash', 'Haircut and Straight Razor Shave with Facial / Wash', 'Haircut with a straight razor face shave, steamer, hot towel treatment, Korean mask, cleanser, and moisturizer, finished with a hair wash.', 90, 18100, NULL, 21);

-- Real shop hours from the canonical Booksy listing (see header).
-- day_of_week: 0 = Sunday … 6 = Saturday
INSERT INTO shop_hours (day_of_week, open_time, close_time, is_closed) VALUES
(0, '11:00', '18:00', 0),
(1, '11:00', '18:00', 1),
(2, '14:00', '18:00', 0),
(3, '11:00', '19:30', 0),
(4, '14:00', '20:00', 0),
(5, '10:30', '20:00', 0),
(6, '11:00', '18:00', 0);
