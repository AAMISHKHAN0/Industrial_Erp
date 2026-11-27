-- Migration: 20261122200000_add_missing_m4_m5_columns
-- Description: Adds missing columns across 6 tables for M4/M5 modules with idempotency (IF NOT EXISTS) and backfills historical data

-- 1. demand_notes (3 columns)
ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "demand_notes" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- 2. demand_note_items (1 column)
ALTER TABLE "demand_note_items" ADD COLUMN IF NOT EXISTS "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 3. purchase_orders (2 columns)
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "qtyTolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "priceTolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 4. purchase_order_items (2 columns)
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "billedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "tolerancePct" DOUBLE PRECISION;

-- 5. goods_receiving_notes (18 columns)
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "deliveryChallanNumber" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "deliveryChallanDate" TIMESTAMP(3);
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceNumber" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceDate" TIMESTAMP(3);
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "supplierInvoiceAmount" DOUBLE PRECISION;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "gatePassNumber" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "driverPhone" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "transporterName" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "biltyNumber" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "costCenter" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectedBy" TEXT;
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);
ALTER TABLE "goods_receiving_notes" ADD COLUMN IF NOT EXISTS "voucherId" TEXT;

-- 6. goods_receiving_items (2 columns)
ALTER TABLE "goods_receiving_items" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;
ALTER TABLE "goods_receiving_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

-- BACKFILL HISTORICAL DATA:
-- Backfill demand_note_items.issuedQty from posted material_issue_items
UPDATE "demand_note_items" dni
SET "issuedQty" = COALESCE((
  SELECT SUM(mii.quantity)
  FROM "material_issue_items" mii
  JOIN "material_issues" mi ON mi.id = mii."issueId"
  WHERE mii."demandNoteItemId" = dni.id
    AND mi.status IN ('POSTED', 'APPROVED', 'ISSUED')
), 0);

-- Backfill purchase_order_items.billedQty from posted supplier_bill_items
UPDATE "purchase_order_items" poi
SET "billedQty" = COALESCE((
  SELECT SUM(sbi."billedQty")
  FROM "supplier_bill_items" sbi
  JOIN "supplier_bills" sb ON sb.id = sbi."billId"
  WHERE sbi."poItemId" = poi.id
    AND sb.status IN ('POSTED', 'APPROVED', 'PAID')
), 0);
