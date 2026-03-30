-- Add contact_email column to company_payments table
ALTER TABLE company_payments
ADD COLUMN IF NOT EXISTS contact_email TEXT;
