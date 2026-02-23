-- Add confirmation fields to agreements for two-way confirmation
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS renter_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS owner_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Update agreement status constraint to support new statuses
ALTER TABLE agreements
  DROP CONSTRAINT IF EXISTS agreements_status_check;

ALTER TABLE agreements
  ADD CONSTRAINT agreements_status_check CHECK (
    status IN ('pending', 'pending_renter', 'pending_owner', 'confirmed', 'cancelled', 'active')
  );

-- Create audit log table to track all application and agreement changes
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('application', 'agreement')),
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_changed_by ON activity_logs(changed_by);
