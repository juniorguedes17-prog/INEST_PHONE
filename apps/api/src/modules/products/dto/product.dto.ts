import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

const PRODUCT_CONDITIONS = ['NOVO', 'SEMINOVO', 'CPO'] as const;

export class ProductQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  modelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'IPHONE_SEALED',
    'IPHONE_USED',
    'APPLE_CPO',
    'MACBOOK',
    'IPAD',
    'APPLE_WATCH',
    'AIRPODS',
    'ACCESSORY',
  ])
  productType?: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  modelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storageId?: string;

  @ApiProperty()
  @IsIn([
    'IPHONE_SEALED',
    'IPHONE_USED',
    'APPLE_CPO',
    'MACBOOK',
    'IPAD',
    'APPLE_WATCH',
    'AIRPODS',
    'ACCESSORY',
  ])
  productType!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isAppleOriginal?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  criticalNotes?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productDescription!: string;

  @ApiProperty()
  @IsIn(PRODUCT_CONDITIONS)
  profitCondition!: (typeof PRODUCT_CONDITIONS)[number];

  @ApiProperty()
  @Transform(({ value }) => parseBrazilianDecimal(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  netProfit!: number;
}

export class UpdateProductDto extends CreateProductDto {}

export class CreateProfitRegistrationProductDto extends OmitType(CreateProductDto, [
  'modelId',
] as const) {}

export class CreateProfitRegistrationModelDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  canonicalModelKey!: string;

  @ApiProperty()
  @IsIn([
    'IPHONE_SEALED',
    'IPHONE_USED',
    'APPLE_CPO',
    'MACBOOK',
    'IPAD',
    'APPLE_WATCH',
    'AIRPODS',
    'ACCESSORY',
  ])
  productType!: string;
}

export class CreateProfitRegistrationDto {
  @ApiProperty({ type: CreateProfitRegistrationProductDto })
  @ValidateNested()
  @Type(() => CreateProfitRegistrationProductDto)
  product!: CreateProfitRegistrationProductDto;

  @ApiProperty({ type: CreateProfitRegistrationModelDto })
  @ValidateNested()
  @Type(() => CreateProfitRegistrationModelDto)
  model!: CreateProfitRegistrationModelDto;
}

export class UpsertCategoryDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  type!: string;
}

export class UpsertModelDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  normalizedName!: string;

  @ApiProperty()
  @IsString()
  productType!: string;
}

export class UpsertColorDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  normalizedName!: string;
}

export class UpsertStorageDto {
  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @IsString()
  displayName!: string;
}

export function parseBrazilianDecimal(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const normalized = value
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '');
  if (!normalized) return Number.NaN;

  const hasComma = normalized.includes(',');
  const numeric = hasComma
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.split('.').at(-1)?.length === 3
      ? normalized.replace(/\./g, '')
      : normalized;
  return Number(numeric);
}
