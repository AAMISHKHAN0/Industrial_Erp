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

export class GrnItemDto {
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() poItemId?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) orderedQty?: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) receivedQty: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) acceptedQty: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rejectedQty?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) unitCost: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lotNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() remarks?: string;
}

export class CreateGoodsReceivingNoteDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() grnNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() poId?: string;
  @ApiProperty() @IsString() vendorId: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receivedDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receivedBy?: string;

  // Paperwork tracking
  @ApiProperty({ required: false }) @IsOptional() @IsString() deliveryChallanNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() deliveryChallanDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() supplierInvoiceNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() supplierInvoiceDate?: string;
  @Type(() => Number)
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() supplierInvoiceAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() gatePassNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vehicleNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transporterName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() biltyNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() departmentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() costCenter?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectionStatus?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectionNotes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectedBy?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectedAt?: string;

  @ApiProperty({ type: [GrnItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items?: GrnItemDto[];
}

export class UpdateGoodsReceivingNoteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  grnNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() poId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vendorId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receivedDate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receivedBy?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;

  // Paperwork tracking
  @ApiProperty({ required: false }) @IsOptional() @IsString() deliveryChallanNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() deliveryChallanDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() supplierInvoiceNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() supplierInvoiceDate?: string;
  @Type(() => Number)
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() supplierInvoiceAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() gatePassNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vehicleNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transporterName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() biltyNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() departmentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() costCenter?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectionStatus?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectionNotes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectedBy?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() inspectedAt?: string;

  @ApiProperty({ type: [GrnItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items?: GrnItemDto[];
}

export class QueryGoodsReceivingNoteDto {
  @ApiProperty({ required: false }) @IsOptional() page?: number;
  @ApiProperty({ required: false }) @IsOptional() limit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() search?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sort?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() poId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vendorId?: string;
}
