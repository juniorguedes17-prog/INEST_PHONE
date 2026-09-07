import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';

export class PricingQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capacity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ['lowest_price', 'highest_price', 'recent', 'highest_profit'] })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class UpdateModelProfitDto {
  @ApiProperty()
  @IsString()
  modelName!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  desiredNetProfit!: number;
}

export class GenerateOfferDraftDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;
}

export class BrazilRadarQuotePricingDto {
  @ApiProperty()
  @IsUUID()
  sourceQuoteId!: string;
}

export class ConfirmBrazilRadarManufacturerDto extends BrazilRadarQuotePricingDto {
  @ApiProperty()
  @IsString()
  canonicalName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alias?: string;
}

export class ReplaceBrazilRadarWorkSnapshotDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  sourceQuoteIds!: string[];
}

export class TemporaryImportPricingDto {
  @ApiPropertyOptional({ enum: ['PY', 'US'], default: 'PY' })
  @IsOptional()
  @IsIn(['PY', 'US'])
  origin?: 'PY' | 'US';

  @ApiProperty()
  @IsString()
  sourceProductId!: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  catalogProductId?: string;

  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceManufacturer?: string | null;

  @ApiPropertyOptional({ enum: ['EXPLICIT_SOURCE'] })
  @IsOptional()
  @IsIn(['EXPLICIT_SOURCE'])
  sourceManufacturerProvenance?: 'EXPLICIT_SOURCE';

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplier!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  store!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  productUrl!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceUsd!: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dollarQuote?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  convertedPrice?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cdeExit?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  redirectCost?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  brazilDispatch?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  invoiceTax?: number;

  @ApiPropertyOptional()
  @ValidateIf((dto: TemporaryImportPricingDto) => (dto.origin ?? 'PY') === 'PY')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  correiosLabel?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCost!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ['NOVO', 'SEMINOVO', 'CPO'] })
  @IsOptional()
  @IsIn(['NOVO', 'SEMINOVO', 'CPO'])
  condition?: 'NOVO' | 'SEMINOVO' | 'CPO';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  matchedProductType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  retailer?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  usaCostBreakdown?: Record<string, string | number | null>;
}
