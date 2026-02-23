-- Migration: add images_paths and rejection_reason to listings
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS images_paths TEXT[] DEFAULT ARRAY[]::text[];

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
