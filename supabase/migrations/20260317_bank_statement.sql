-- Add bank_statement_url to company_payments
ALTER TABLE company_payments ADD COLUMN IF NOT EXISTS bank_statement_url TEXT;

-- Create storage bucket (This is usually done via SDK or Supabase dashboard, 
-- but we can record it here for the user to run if they have SQL permissions for storage)

-- Note: In Supabase, buckets are managed in the `storage` schema.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bank-statements', 'bank-statements', true) ON CONFLICT (id) DO NOTHING;
