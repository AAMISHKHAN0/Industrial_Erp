-- Migration: 20261125000000_fix_company_grn_voucher_columns
-- 1. Add city and country columns to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "country" TEXT;

-- 2. Allow NULL poId on goods_receiving_notes for Direct GRN (Non-PO)
ALTER TABLE "goods_receiving_notes" ALTER COLUMN "poId" DROP NOT NULL;

-- 3. Add vendorId and metadata columns to vouchers for strict vendor payment filtering & payment/expense persistence
ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
CREATE INDEX IF NOT EXISTS "vouchers_companyId_vendorId_voucherType_idx" ON "vouchers"("companyId", "vendorId", "voucherType");
