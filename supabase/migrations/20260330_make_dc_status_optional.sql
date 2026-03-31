-- Make dc_status optional (nullable) and remove default
ALTER TABLE company_payments
    ALTER COLUMN dc_status DROP DEFAULT,
    ALTER COLUMN dc_status DROP NOT NULL;
