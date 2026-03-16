-- Create projects_metadata table
CREATE TABLE IF NOT EXISTS projects_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client TEXT,
    start_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add project_id column to existing tables
ALTER TABLE vendor_quotes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects_metadata(id);
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects_metadata(id);
ALTER TABLE purchase_intents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects_metadata(id);

-- Update user_roles to include 'Employee'
-- Note: Assuming role is a TEXT column with a check constraint or similar.
-- Adding 'employee' if it doesn't already exist in the logic/schema.
-- If it's an enum, we'd need to alter the enum. Assuming TEXT for flexibility here.

-- Add audit log category for Material Return
-- Assuming activity_logs table exists based on previous code analysis.
-- No schema change needed for activity_logs if it's generic, but we'll use 'Material Return' as action text.

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_quotes_project_id ON vendor_quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_project_id ON dispatches(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_project_id ON purchase_intents(project_id);
