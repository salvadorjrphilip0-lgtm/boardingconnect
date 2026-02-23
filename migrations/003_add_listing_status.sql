-- Migration: add status column to listings
-- Adds a status column with possible values: 'pending', 'approved', 'rejected'
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Backfill existing rows: if verified is true -> approved, else pending
UPDATE listings SET status = CASE WHEN verified = true THEN 'approved' ELSE 'pending' END;

-- Optional: add a check constraint to limit values
ALTER TABLE listings
ADD CONSTRAINT listings_status_check CHECK (status IN ('pending','approved','rejected'));
