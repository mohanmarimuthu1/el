-- Create employee_worklogs table linked to user_roles
CREATE TABLE IF NOT EXISTS employee_worklogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_roles(user_id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('present', 'half_day', 'absent', 'leave')),
    hours_worked NUMERIC(5, 2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    
    -- Ensure only one entry per user per day to avoid duplicates
    UNIQUE(user_id, log_date)
);

-- Enable RLS
ALTER TABLE employee_worklogs ENABLE ROW LEVEL SECURITY;

-- Policies for employee_worklogs
-- Admins and owners can access everything
CREATE POLICY "Admins and owners have full access to worklogs"
ON employee_worklogs
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND role IN ('admin', 'owner', 'manager')
    )
);

-- Employees can read their own worklogs
CREATE POLICY "Users can view their own worklogs"
ON employee_worklogs
FOR SELECT
USING (auth.uid() = user_id);

-- Employees can insert/update their own worklogs
CREATE POLICY "Users can insert their own worklogs"
ON employee_worklogs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own worklogs"
ON employee_worklogs
FOR UPDATE
USING (auth.uid() = user_id);
