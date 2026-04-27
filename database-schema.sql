-- Boarding Connect Database Schema for Supabase
-- Full schema aligned with current backend controllers

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- Core Tables
-- =========================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  profile_picture TEXT,
  website_rating INTEGER CHECK (website_rating >= 1 AND website_rating <= 5),
  website_review_comment TEXT,
  website_reviewed_at TIMESTAMP WITH TIME ZONE,
  -- ID verification fields (used when registering owners/renters)
  id_type TEXT,
  id_number TEXT,
  id_image TEXT,
  id_image_path TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('renter', 'owner', 'admin')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Listings Table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  -- kept for compatibility with concern/review selects that request listings.address
  address TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  amenities TEXT[] DEFAULT ARRAY[]::text[],
  images TEXT[] DEFAULT ARRAY[]::text[],
  -- storage paths for images (used when files are uploaded to Supabase Storage)
  images_paths TEXT[] DEFAULT ARRAY[]::text[],
  -- listing moderation/status fields
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(listing_id, applicant_id)
);

-- Agreements Table
CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pending_owner', 'pending_renter', 'confirmed', 'cancelled', 'active')),
  rent_status VARCHAR(20) NOT NULL DEFAULT 'due' CHECK (rent_status IN ('due', 'paid', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  terms TEXT,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- confirmation timestamps
  renter_confirmed_at TIMESTAMP WITH TIME ZONE,
  owner_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (listing_id, renter_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id VARCHAR(255),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reviews Table (renters review boarding houses)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(listing_id, renter_id)
);

-- Owner Reviews Table (renters review owners separately from listing reviews)
CREATE TABLE IF NOT EXISTS owner_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, listing_id, renter_id)
);

-- Monthly Income Records Table (captures every owner payment save)
CREATE TABLE IF NOT EXISTS monthly_income_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_price DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (listing_price >= 0),
  total_payment DECIMAL(10, 2) NOT NULL CHECK (total_payment >= 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('paid', 'partial', 'unpaid')),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Concerns Table (renters report issues about boarding houses)
CREATE TABLE IF NOT EXISTS concerns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table (admin generates reports)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('user_activity', 'listing_verification', 'concerns_summary', 'revenue')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Activity Logs Table (audit trail for applications and agreements)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('application', 'agreement')),
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset Requests Table (stores pending password reset requests)
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_password VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_verified ON listings(verified);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(location);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at);
CREATE INDEX IF NOT EXISTS idx_listings_images_paths ON listings USING gin(images_paths);

CREATE INDEX IF NOT EXISTS idx_applications_listing ON applications(listing_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);

CREATE INDEX IF NOT EXISTS idx_agreements_owner ON agreements(owner_id);
CREATE INDEX IF NOT EXISTS idx_agreements_renter ON agreements(renter_id);
CREATE INDEX IF NOT EXISTS idx_agreements_listing ON agreements(listing_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_rent_status ON agreements(rent_status);
CREATE INDEX IF NOT EXISTS idx_agreements_created_at ON agreements(created_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_renter_id ON reviews(renter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_owner_reviews_owner_id ON owner_reviews(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_reviews_listing_id ON owner_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_owner_reviews_renter_id ON owner_reviews(renter_id);
CREATE INDEX IF NOT EXISTS idx_owner_reviews_created_at ON owner_reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_monthly_income_records_recorded_at ON monthly_income_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_monthly_income_records_owner_id ON monthly_income_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_monthly_income_records_renter_id ON monthly_income_records(renter_id);
CREATE INDEX IF NOT EXISTS idx_monthly_income_records_listing_id ON monthly_income_records(listing_id);

CREATE INDEX IF NOT EXISTS idx_concerns_listing_id ON concerns(listing_id);
CREATE INDEX IF NOT EXISTS idx_concerns_renter_id ON concerns(renter_id);
CREATE INDEX IF NOT EXISTS idx_concerns_status ON concerns(status);
CREATE INDEX IF NOT EXISTS idx_concerns_created_at ON concerns(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports(generated_by);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_by ON activity_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created_at ON password_reset_requests(created_at);

-- =========================
-- Trigger for updated_at
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agreements_updated_at ON agreements;
CREATE TRIGGER update_agreements_updated_at BEFORE UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_owner_reviews_updated_at ON owner_reviews;
CREATE TRIGGER update_owner_reviews_updated_at BEFORE UPDATE ON owner_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_concerns_updated_at ON concerns;
CREATE TRIGGER update_concerns_updated_at BEFORE UPDATE ON concerns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Compatibility Backfills (safe to run on existing DB)
-- =========================

-- listings.address is referenced by concern/review joins in controllers
ALTER TABLE listings ADD COLUMN IF NOT EXISTS address TEXT;
UPDATE listings SET address = location WHERE address IS NULL;

-- Website review fields for one-time per-account rating
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_rating INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_review_comment TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_reviewed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_website_rating_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_website_rating_check;
  END IF;

  ALTER TABLE users
    ADD CONSTRAINT users_website_rating_check
    CHECK (website_rating IS NULL OR (website_rating >= 1 AND website_rating <= 5));
END $$;

-- Ensure array columns have defaults
ALTER TABLE listings ALTER COLUMN amenities SET DEFAULT ARRAY[]::text[];
ALTER TABLE listings ALTER COLUMN images SET DEFAULT ARRAY[]::text[];
ALTER TABLE listings ALTER COLUMN images_paths SET DEFAULT ARRAY[]::text[];

-- Ensure applications supports cancelled status used by controller
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_status_check'
      AND conrelid = 'applications'::regclass
  ) THEN
    ALTER TABLE applications DROP CONSTRAINT applications_status_check;
  END IF;

  ALTER TABLE applications
    ADD CONSTRAINT applications_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'));
END $$;

-- Ensure agreements status supports pending_owner/pending_renter used by controller
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agreements_status_check'
      AND conrelid = 'agreements'::regclass
  ) THEN
    ALTER TABLE agreements DROP CONSTRAINT agreements_status_check;
  END IF;

  ALTER TABLE agreements
    ADD CONSTRAINT agreements_status_check
    CHECK (status IN ('pending', 'pending_owner', 'pending_renter', 'confirmed', 'cancelled', 'active'));
END $$;

-- changed_by must be nullable for ON DELETE SET NULL behavior
ALTER TABLE activity_logs ALTER COLUMN changed_by DROP NOT NULL;

-- =========================
-- Seed (optional)
-- =========================

-- Insert sample admin user (password: admin123)
INSERT INTO users (email, password, full_name, phone, role, verified)
VALUES (
  'admin@boardingconnect.com',
  '$2a$10$xQZ8kK5vWj7zqYHJnJKCIe4YvR9ELyRJxBXvY5xQZ8kK5vWj7zqYH', -- bcrypt hash of 'admin123'
  'System Administrator',
  '+63 123 456 7890',
  'admin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;
