import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsIn,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : value === null
      ? undefined
      : value;

export class BillAllocationDto {
  @ApiProperty()
  @IsUUID()
  supplierBillId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreateVendorPaymentDto {
  @ApiProperty()
  @IsUUID()
  vendorId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, enum: ['BANK', 'CASH'], default: 'BANK' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['BANK', 'CASH'])
  paymentMethod?: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  supplierBillId?: string;

  @ApiProperty({ required: false, type: [BillAllocationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillAllocationDto)
  billAllocations?: BillAllocationDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  requestKey?: string;
}

export class CreateUtilityPaymentDto {
  @ApiProperty({ example: 'ELECTRICITY' })
  @IsString()
  utilityType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  providerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  consumerNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  billingMonth?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, enum: ['BANK', 'CASH'], default: 'BANK' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['BANK', 'CASH'])
  paymentMethod?: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  requestKey?: string;
}

export class CreateFixedAssetPaymentDto {
  @ApiProperty()
  @IsString()
  assetDescription: string;

  @ApiProperty({ example: 'MACHINERY' })
  @IsString()
  assetCategory: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  vendorName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  serialOrInvoice?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, enum: ['BANK', 'CASH'], default: 'BANK' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['BANK', 'CASH'])
  paymentMethod?: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  requestKey?: string;
}

export class CreateOutgoingPaymentDto {
  @ApiProperty({
    enum: ['VENDOR_PAYMENT', 'UTILITY', 'FIXED_ASSET', 'STATUTORY'],
  })
  @IsIn(['VENDOR_PAYMENT', 'UTILITY', 'FIXED_ASSET', 'STATUTORY'])
  group: 'VENDOR_PAYMENT' | 'UTILITY' | 'FIXED_ASSET' | 'STATUTORY';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, enum: ['BANK', 'CASH'], default: 'BANK' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['BANK', 'CASH'])
  paymentMethod?: 'BANK' | 'CASH';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  requestKey?: string;

  // VENDOR_PAYMENT fields
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  supplierBillId?: string;

  @ApiProperty({ required: false, type: [BillAllocationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillAllocationDto)
  billAllocations?: BillAllocationDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  reference?: string;

  // UTILITY fields
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  utilityType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  providerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  consumerNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  billingMonth?: string;

  // FIXED_ASSET fields
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  assetDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  assetCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  vendorName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  serialOrInvoice?: string;

  // STATUTORY fields
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  obligationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  head?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  authority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  taxPeriod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  cprNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  psid?: string;
}

export class QueryPaymentsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  group?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
