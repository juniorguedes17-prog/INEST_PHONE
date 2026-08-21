import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

export class GenerateOfferDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

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
