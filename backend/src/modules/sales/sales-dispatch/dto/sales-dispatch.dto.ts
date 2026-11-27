import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalesDispatchItemDto {
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  soItemId?: string;
}

export class CreateSalesDispatchDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  soId?: string;

  @IsOptional()
  @IsString()
  dispatchNumber?: string;

  @IsOptional()
  dispatchDate?: Date | string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesDispatchItemDto)
  items: SalesDispatchItemDto[];
}
