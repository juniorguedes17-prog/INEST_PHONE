import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UsaEnrichmentSourceProductDto {
  @ApiProperty()
  @IsString()
  providerName!: string;

  @ApiProperty()
  @IsString()
  sourceProductId!: string;

  @ApiProperty()
  @IsString()
  sourceName!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ enum: ['US'] })
  @IsIn(['US'])
  source!: 'US';

  @ApiProperty()
  @IsString()
  sourceUrl!: string;

  @ApiProperty()
  @IsString()
  supplier!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  sourceManufacturer?: string | null;

  @ApiPropertyOptional({ enum: ['EXPLICIT_SOURCE'], nullable: true })
  @IsOptional()
  @IsIn(['EXPLICIT_SOURCE'])
  sourceManufacturerProvenance?: 'EXPLICIT_SOURCE' | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  retailer?: string | null;

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capacity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: ['NOVO', 'SEMINOVO', 'CPO'], nullable: true })
  @IsOptional()
  @IsIn(['NOVO', 'SEMINOVO', 'CPO'])
  condition?: 'NOVO' | 'SEMINOVO' | 'CPO' | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  priceUsd!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceEvidence?: string;

  @ApiPropertyOptional({ enum: ['FAMILY_STARTING_AT', 'CONFIGURED_PRODUCT'] })
  @IsOptional()
  @IsIn(['FAMILY_STARTING_AT', 'CONFIGURED_PRODUCT'])
  offerKind?: 'FAMILY_STARTING_AT' | 'CONFIGURED_PRODUCT';
}

export class UsaEnrichmentDecisionDto {
  @ApiProperty({ type: UsaEnrichmentSourceProductDto })
  @ValidateNested()
  @Type(() => UsaEnrichmentSourceProductDto)
  sourceProduct!: UsaEnrichmentSourceProductDto;
}

export class UsaManufacturerConfirmationDto extends UsaEnrichmentDecisionDto {
  @ApiProperty()
  @IsString()
  canonicalName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alias?: string;
}
