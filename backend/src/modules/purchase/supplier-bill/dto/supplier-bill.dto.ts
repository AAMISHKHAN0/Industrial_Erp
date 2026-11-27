import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SupplierBillItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  grnId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  grnItemId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  poItemId?: string;

  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  billedQty: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;
}

export class CreateSupplierBillDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  billNumber?: string;

  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsString()
  supplierInvoiceNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  supplierInvoiceDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  billDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SupplierBillItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierBillItemDto)
  items: SupplierBillItemDto[];
}

export class QuerySupplierBillDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
