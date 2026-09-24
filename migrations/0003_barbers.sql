-- Closer Shave booking demo — multi-barber model (migration 0003).
-- Adds a barbers table, per-barber weekly hours (multiple windows per day,
-- so split shifts like Juan's Monday are representable), and wires
-- services + bookings to a barber via barber_id.
--
-- Blank weekday for a barber = closed (no rows in barber_hours).
-- The legacy shop_hours table is retained for display/back-compat but no
-- longer drives availability.

CREATE TABLE barbers (
    id TEXT PRIMARY KEY,                    -- stable slug: 'jesse', 'temur', 'juan', 'rj'
    name TEXT NOT NULL,                     -- display name
    photo_url TEXT NOT NULL,                -- Booksy CDN profile photo
    booksy_url TEXT NOT NULL,               -- Booksy provider listing
    phone TEXT,                             -- public booking phone
    rating REAL NOT NULL DEFAULT 5.0,
    review_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,                             -- short display extras (e.g. "second floor")
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') * 1000 as integer))
);

-- Per-barber weekly hours. One row per open window; a day with no rows is
-- closed. window_index orders multiple windows on the same day (split shift).
-- day_of_week: 0 = Sunday, 6 = Saturday. Times are "HH:MM" wall clock in
-- America/Los_Angeles.
CREATE TABLE barber_hours (
    barber_id TEXT NOT NULL REFERENCES barbers(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    window_index INTEGER NOT NULL DEFAULT 0 CHECK (window_index >= 0),
    open_time TEXT NOT NULL,
    close_time TEXT NOT NULL,
    PRIMARY KEY (barber_id, day_of_week, window_index)
);

ALTER TABLE services ADD COLUMN barber_id TEXT REFERENCES barbers(id);
ALTER TABLE bookings ADD COLUMN barber_id TEXT REFERENCES barbers(id);

CREATE INDEX idx_services_barber_id ON services(barber_id);
CREATE INDEX idx_bookings_barber_id ON bookings(barber_id);
CREATE INDEX idx_barber_hours_lookup ON barber_hours(barber_id, day_of_week, window_index);

-- Placeholder barber rows so the backfill below satisfies the barber_id FK.
-- seeds/barbers.sql upserts the full records (photos, hours, services) after.
INSERT INTO barbers (id, name, photo_url, booksy_url, sort_order) VALUES
  ('jesse', 'Jesse Marquez', '', '', 1),
  ('temur', 'Temur Gold', '', '', 2),
  ('juan', 'Juan Murillo', '', '', 3),
  ('rj', 'RJ', '', '', 4)
ON CONFLICT (id) DO NOTHING;

-- Backfill: every existing booking was made in the single-barber
-- (itsrjstyles) era; itsrjstyles becomes the 'rj' barber.
UPDATE bookings SET barber_id = 'rj', barber = 'rj' WHERE barber = 'itsrjstyles';
