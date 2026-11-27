import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WageLineDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  daysWorked: number; // Supports fractional days, e.g. 5.5

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate: number; // e.g. PKR 2,000

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deductions?: number;
}

export class CreateWageRunDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @IsOptional()
  @IsString()
  runType?: string; // 'DAILY_WAGE' | 'MONTHLY'

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WageLineDto)
  lines: WageLineDto[];
}

export class DisburseWageRunDto {
  @IsOptional()
  @IsString()
  paymentMethod?: 'BANK' | 'CASH';

  @IsOptional()
  @IsString()
  notes?: string;
}
