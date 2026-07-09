import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PriceRadarQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    enum: ['lowest_price', 'highest_price', 'recent', 'supplier', 'product', 'delivery'],
  })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class CreatePriceQuoteDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costProduct!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  quoteDate?: string;
}

export class UpdatePriceQuoteDto extends CreatePriceQuoteDto {}

export class CsvImportDto {
  @ApiProperty({
    description:
      'Conteudo CSV em texto. Colunas esperadas: productId,supplierId,costProduct,deliveryTime,city,quality,notes',
  })
  @IsString()
  csvContent!: string;
}

export class ValidateQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
