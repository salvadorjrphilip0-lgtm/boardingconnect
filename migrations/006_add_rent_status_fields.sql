-- Add rent management fields to agreements table
ALTER TABLE agreements
  ADD COLUMN rent_status VARCHAR(20) DEFAULT 'due' CHECK (rent_status IN ('due','paid','cancelled')),
  ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
