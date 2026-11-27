-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN "reversalOfVoucherId" TEXT;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversalOfVoucherId_fkey" FOREIGN KEY ("reversalOfVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
