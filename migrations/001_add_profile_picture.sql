-- Migration: Add profile_picture column to users table
-- Description: Adds column to store user profile picture URLs
-- Created: 2025-11-17

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add index for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture);
