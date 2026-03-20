-- Create company_payments table
CREATE TABLE IF NOT EXISTS company_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    pending_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
    priority TEXT NOT NULL DEFAULT 'later' CHECK (priority IN ('immediate', 'later')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_payments ENABLE ROW LEVEL SECURITY;

-- Allow all actions for now (match project's open pattern)
CREATE POLICY "Allow all for authenticated" ON company_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON company_payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_payments_updated_at
    BEFORE UPDATE ON company_payments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
