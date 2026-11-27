import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsArray,
  IsDateString,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class JournalItemDto {
  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  debitAmount: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditAmount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entryNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [JournalItemDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalItemDto)
  items: JournalItemDto[];
}

export class UpdateJournalEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entryNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPosted?: boolean;

  @ApiProperty({ required: false, type: [JournalItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalItemDto)
  items?: JournalItemDto[];
}

export class QueryJournalEntryDto {
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
