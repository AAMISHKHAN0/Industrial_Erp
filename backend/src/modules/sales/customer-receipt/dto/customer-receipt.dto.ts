import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiptAllocationDto {
  @IsNotEmpty()
  @IsString()
  invoiceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  withholding?: number;
}

export class CreateCustomerReceiptDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  receiptDate?: Date | string;

  @IsNotEmpty()
  @IsIn(['CASH', 'BANK', 'CHEQUE'])
  paymentMethod: 'CASH' | 'BANK' | 'CHEQUE';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountReceived: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxWithheld?: number;

  @IsOptional()
  @IsString()
  withholdingCertificate?: string;

  @IsOptional()
  @IsString()
  withholdingSection?: string;

  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @IsOptional()
  chequeDate?: Date | string;

  @IsOptional()
  @IsString()
  chequeBank?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptAllocationDto)
  allocations?: ReceiptAllocationDto[];
}
