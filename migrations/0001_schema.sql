-- Closer Shave booking demo — D1 schema
-- SQLite syntax for Cloudflare D1

-- Services offered by the shop (demo data; prices from public Booksy listing)
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER,          -- NULL = price not confirmed (TBD)
    price_note TEXT,              -- shown when price is TBD or approximate
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') * 1000 as integer))
);

-- Weekly shop hours, wall-clock times in the shop timezone (America/Los_Angeles)
-- day_of_week: 0 = Sunday, 6 = Saturday
CREATE TABLE shop_hours (
    day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TEXT NOT NULL,      -- "09:00"
    close_time TEXT NOT NULL,     -- "18:00"
    is_closed INTEGER NOT NULL DEFAULT 0
);

-- Bookings made through the demo site
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,          -- e.g. CSH-4F8K2Q
    service_id TEXT NOT NULL REFERENCES services(id),
    barber TEXT NOT NULL DEFAULT 'itsrjstyles',
    guest_name TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    guest_email TEXT,
    notes TEXT,
    start_ts INTEGER NOT NULL,    -- epoch ms, UTC
    end_ts INTEGER NOT NULL,      -- epoch ms, UTC
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    confirmation_sent INTEGER NOT NULL DEFAULT 0,
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s', 'now') * 1000 as integer))
);

CREATE INDEX idx_bookings_start ON bookings(start_ts);
CREATE INDEX idx_bookings_status_start ON bookings(status, start_ts);
