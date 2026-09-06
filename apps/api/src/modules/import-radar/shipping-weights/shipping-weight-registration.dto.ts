import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import type { ImportProductCondition } from '../condition-normalizer';
import type { SourceManufacturerProvenance } from '../financial-classification';

export class ShippingWeightSourceProductDto {
  @IsString()
  sourceProductId!: string;

  @IsString()
  sourceName!: string;

  @IsString()
  supplier!: string;

  @IsUrl()
  sourceUrl!: string;

  @IsIn(['US'])
  origin!: 'US';

  @IsOptional()
  @IsString()
  sourceQuoteId?: string;

  @IsOptional()
  @IsString()
  sourceManufacturer?: string;

  @IsOptional()
  @IsIn(['EXPLICIT_SOURCE'])
  sourceManufacturerProvenance?: SourceManufacturerProvenance;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['NOVO', 'SEMINOVO', 'CPO'])
  condition?: ImportProductCondition;
}

export class ShippingWeightCompositionDto {
  /** Bundles without an independently structured signature remain blocked. */
  @IsIn(['SINGLE_ITEM', 'UNSTRUCTURED_BUNDLE'])
  kind!: 'SINGLE_ITEM' | 'UNSTRUCTURED_BUNDLE';
}

export class RegisterShippingWeightDto {
  @ValidateNested()
  @Type(() => ShippingWeightSourceProductDto)
  sourceProduct!: ShippingWeightSourceProductDto;

  @ValidateNested()
  @Type(() => ShippingWeightCompositionDto)
  composition!: ShippingWeightCompositionDto;

  @IsNumber()
  shippingWeightLbs!: number;
}
