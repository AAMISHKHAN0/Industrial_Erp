import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) quantity: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPct?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxPct?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalPrice?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tolerancePct?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() poNumber?: string;
  @ApiProperty() @IsString() vendorId: string;
  @Type(() => Number)
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() qtyTolerancePct?: number;
  @Type(() => Number)
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() priceTolerancePct?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  demandNoteId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  orderDate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  expectedDelivery?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentTerms?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grandTotal?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, type: [PurchaseOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() poNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vendorId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  demandNoteId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  orderDate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  expectedDelivery?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentTerms?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grandTotal?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, type: [PurchaseOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

export class QueryPurchaseOrderDto {
  @ApiProperty({ required: false }) @IsOptional() page?: number;
  @ApiProperty({ required: false }) @IsOptional() limit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() search?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sort?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
}
