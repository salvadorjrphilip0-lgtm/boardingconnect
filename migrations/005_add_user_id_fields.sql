-- Migration: add ID verification columns to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS id_type TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS id_number TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS id_image TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS id_image_path TEXT;

-- Note: id_image stores public URL to the uploaded ID image; id_image_path stores the storage path
