import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ShippingWeightCompositionDto } from '../shipping-weights/shipping-weight-registration.dto';
import { UsaEnrichmentSourceProductDto } from './usa-enrichment.dto';

export class UsaCostPreflightRedirectorDto {
  @ApiProperty({ enum: ['RED_DELAWARE', 'REI_DO_IMPORTADO'] })
  @IsIn(['RED_DELAWARE', 'REI_DO_IMPORTADO'])
  redirector!: 'RED_DELAWARE' | 'REI_DO_IMPORTADO';

  @ApiPropertyOptional({ enum: ['EXPRESS'] })
  @IsOptional()
  @IsIn(['EXPRESS'])
  shippingMode?: 'EXPRESS';
}

export class UsaCostPreflightDto {
  @ApiProperty({ type: UsaEnrichmentSourceProductDto })
  @ValidateNested()
  @Type(() => UsaEnrichmentSourceProductDto)
  sourceProduct!: UsaEnrichmentSourceProductDto;

  @ApiProperty({ type: UsaCostPreflightRedirectorDto })
  @ValidateNested()
  @Type(() => UsaCostPreflightRedirectorDto)
  redirector!: UsaCostPreflightRedirectorDto;

  @ApiProperty({ type: ShippingWeightCompositionDto })
  @ValidateNested()
  @Type(() => ShippingWeightCompositionDto)
  composition!: ShippingWeightCompositionDto;

  @ApiPropertyOptional({ description: 'Contexto apenas; nao participa da autoridade.' })
  @IsOptional()
  @IsString()
  requestId?: string;
}
