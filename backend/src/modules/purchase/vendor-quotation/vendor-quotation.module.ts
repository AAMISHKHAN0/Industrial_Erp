import { Module } from '@nestjs/common';
import { VendorQuotationController } from './vendor-quotation.controller';
import { VendorQuotationService } from './vendor-quotation.service';

@Module({
  controllers: [VendorQuotationController],
  providers: [VendorQuotationService],
  exports: [VendorQuotationService],
})
export class VendorQuotationModule {}
