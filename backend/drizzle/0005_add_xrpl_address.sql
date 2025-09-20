-- Add XRPL address column to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS xrpl_address text;
-- Unique constraint (nullable unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'companies_xrpl_address_unique'
      AND table_name = 'companies'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_xrpl_address_unique UNIQUE (xrpl_address);
  END IF;
END$$;
