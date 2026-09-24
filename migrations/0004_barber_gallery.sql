-- Closer Shave booking demo — per-barber work galleries (migration 0004).
--
-- Adds a gallery_images TEXT column to barbers holding a JSON array of the
-- barber's Booksy portfolio ("inspiration") image URLs. The seed
-- (seeds/barbers.sql) populates the URLs; this column only holds them.

ALTER TABLE barbers ADD COLUMN gallery_images TEXT NOT NULL DEFAULT '[]';
