-- Add total_amount column to track actual initial amounts securely alongside pending amounts
ALTER TABLE company_payments
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;
