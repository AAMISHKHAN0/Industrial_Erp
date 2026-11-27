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

export class VendorQuotationItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

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
  discountPct?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxPct?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  totalPrice: number;
}

export class CreateVendorQuotationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationNumber?: string;

  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  demandNoteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryTime?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warranty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiProperty({ required: false, type: [VendorQuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorQuotationItemDto)
  items?: VendorQuotationItemDto[];
}

export class UpdateVendorQuotationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  demandNoteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  quotationDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryTime?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warranty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiProperty({ required: false, type: [VendorQuotationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorQuotationItemDto)
  items?: VendorQuotationItemDto[];
}

export class QueryVendorQuotationDto {
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
  sort?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
