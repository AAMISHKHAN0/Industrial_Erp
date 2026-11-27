import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateObligationDto {
  @IsNotEmpty()
  @IsString()
  head: string; // 'SALES_TAX' | 'INCOME_TAX' | 'CUSTOMS_DUTY' | 'PROFESSIONAL_TAX' | 'PESSI' | 'LABOUR'

  @IsNotEmpty()
  @IsString()
  authority: string; // 'FBR' | 'PRA' | 'SRB' | 'PUNJAB_EXCISE' | 'PESSI'

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsNotEmpty()
  @IsString()
  taxPeriod: string; // e.g. '2026-01', 'FY-2025-2026'

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  dueAmount: number;

  @IsOptional()
  dueDate?: Date | string;

  @IsOptional()
  @IsString()
  assessmentReference?: string;

  @IsOptional()
  @IsString()
  challanNumber?: string;

  @IsOptional()
  @IsString()
  psid?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordStatutoryPaymentDto {
  @IsNotEmpty()
  @IsString()
  obligationId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsIn(['BANK', 'CASH'])
  paymentMethod: 'BANK' | 'CASH';

  @IsOptional()
  paymentDate?: Date | string;

  @IsOptional()
  @IsString()
  cprNumber?: string;

  @IsOptional()
  @IsString()
  psid?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsString()
  requestKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
