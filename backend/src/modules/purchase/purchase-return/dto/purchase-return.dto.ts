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

export class PurchaseReturnItemDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  returnNumber?: string;

  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  grnId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierBillId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  debitNoteNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gatePassNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [PurchaseReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnItemDto)
  items: PurchaseReturnItemDto[];
}

export class QueryPurchaseReturnDto {
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
  warehouseId?: string;
}
