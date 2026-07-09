import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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
}

export class UpdateProductDto extends CreateProductDto {}

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
