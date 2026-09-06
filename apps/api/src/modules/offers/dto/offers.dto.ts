import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ExternalOfferIdentityDto {
  @ApiProperty({ enum: ['US'] })
  @IsIn(['US'])
  origin!: 'US';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  provider!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceProductId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  retailer?: string;
}

export class GenerateOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ type: ExternalOfferIdentityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalOfferIdentityDto)
  externalIdentity?: ExternalOfferIdentityDto;

  @ApiPropertyOptional({ description: 'Preco de venda aprovado no fluxo server-side externo.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ description: 'Preco de oferta aprovado no fluxo server-side externo.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offerPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  productType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  capacity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class DuplicateOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOfferTemplateDto {
  @ApiProperty({ description: 'Conteudo comercial do template.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}

class OfferDraftPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceQuoteId?: string;

  @ApiPropertyOptional({ type: ExternalOfferIdentityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalOfferIdentityDto)
  externalIdentity?: ExternalOfferIdentityDto;

  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiProperty()
  @IsString()
  color!: string;

  @ApiProperty()
  @IsString()
  capacity!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  salePrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  offerPrice!: number;

  @ApiProperty()
  @IsString()
  deliveryTime!: string;

  @ApiProperty()
  @IsString()
  warranty!: string;
}

class OfferDraftDto {
  @ApiProperty()
  @IsString()
  targetModule!: string;

  @ApiProperty()
  @IsString()
  route!: string;

  @ApiPropertyOptional({ description: 'Momento imutável em que o rascunho foi criado.' })
  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ enum: ['pricing', 'temporary-import', 'radar-quote'] })
  @IsOptional()
  @IsIn(['pricing', 'temporary-import', 'radar-quote'])
  source?: 'pricing' | 'temporary-import' | 'radar-quote';

  @ApiProperty({ type: OfferDraftPayloadDto })
  @ValidateNested()
  @Type(() => OfferDraftPayloadDto)
  payload!: OfferDraftPayloadDto;
}

export class ReplaceOffersWorkSnapshotDto {
  @ApiProperty({ type: [OfferDraftDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfferDraftDto)
  drafts!: OfferDraftDto[];

  @ApiProperty()
  @IsInt()
  @Min(0)
  failedCount!: number;
}
