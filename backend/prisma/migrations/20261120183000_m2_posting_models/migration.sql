-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "periodId" TEXT,
ADD COLUMN     "voucherId" TEXT;

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "resultId" TEXT,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "voucherNumber" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "periodId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fifo_layers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceMovementId" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "originalQty" DECIMAL(20,4) NOT NULL,
    "remainingQty" DECIMAL(20,4) NOT NULL,
    "unitCost" DECIMAL(20,4) NOT NULL,
    "trackedValue" DECIMAL(20,2) NOT NULL,
    "sourceLot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fifo_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fifo_allocations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "stockMovementId" TEXT,
    "quantity" DECIMAL(20,4) NOT NULL,
    "unitCost" DECIMAL(20,4) NOT NULL,
    "allocatedValue" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fifo_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_companyId_requestKey_idx" ON "idempotency_keys"("companyId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_companyId_action_requestKey_key" ON "idempotency_keys"("companyId", "action", "requestKey");

-- CreateIndex
CREATE INDEX "accounting_periods_companyId_startDate_endDate_idx" ON "accounting_periods"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_companyId_name_key" ON "accounting_periods"("companyId", "name");

-- CreateIndex
CREATE INDEX "vouchers_companyId_voucherType_businessDate_idx" ON "vouchers"("companyId", "voucherType", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_companyId_voucherNumber_key" ON "vouchers"("companyId", "voucherNumber");

-- CreateIndex
CREATE INDEX "fifo_layers_companyId_warehouseId_itemId_status_idx" ON "fifo_layers"("companyId", "warehouseId", "itemId", "status");

-- CreateIndex
CREATE INDEX "fifo_layers_companyId_warehouseId_itemId_receiptDate_sequen_idx" ON "fifo_layers"("companyId", "warehouseId", "itemId", "receiptDate", "sequence");

-- CreateIndex
CREATE INDEX "fifo_allocations_companyId_layerId_idx" ON "fifo_allocations"("companyId", "layerId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_voucherId_key" ON "journal_entries"("voucherId");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_layers" ADD CONSTRAINT "fifo_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_allocations" ADD CONSTRAINT "fifo_allocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fifo_allocations" ADD CONSTRAINT "fifo_allocations_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "fifo_layers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
