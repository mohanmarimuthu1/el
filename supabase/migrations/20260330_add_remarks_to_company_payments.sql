-- Add remarks column to company_payments table
ALTER TABLE company_payments
ADD COLUMN IF NOT EXISTS remarks TEXT;
