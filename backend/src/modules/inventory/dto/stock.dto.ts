import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferStockDto {
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty() @IsString() fromWarehouseId: string;
  @ApiProperty() @IsString() toWarehouseId: string;
  @Type(() => Number)
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
}

export class GetStockDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() itemId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
