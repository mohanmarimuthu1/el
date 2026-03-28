-- Add delivery challan (DC) status to company_payments
ALTER TABLE company_payments ADD COLUMN IF NOT EXISTS dc_status TEXT DEFAULT 'not_sent';-- 'not_sent', 'sent', 'na'
