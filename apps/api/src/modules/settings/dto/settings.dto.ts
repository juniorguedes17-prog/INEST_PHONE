import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeneralSettingsDto {
  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsString()
  tradeName!: string;

  @ApiProperty()
  @IsString()
  cnpj!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  mainWhatsapp!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;
}

export class FinancialSettingsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  globalFixedCost!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  defaultFreight!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  defaultPaymentFee!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  defaultMargin!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  defaultDiscount!: number;
}

export class ImportRedirectRuleDto {
  @ApiProperty()
  @IsString()
  productType!: string;

  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  matchTerms!: string[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  redirectCost!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priority!: number;
}

export class ImportSettingsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  dollarQuote!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  cdeExitPerBox!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  brazilDispatchPerBox!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  correiosLabel!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  invoiceTaxPercent!: number;

  @ApiProperty({ type: [ImportRedirectRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRedirectRuleDto)
  redirectRules!: ImportRedirectRuleDto[];
}

export class UsaFinancialSettingsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  dollarQuote!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  airFreight!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  freightDiscountPercent!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  administrativeFee!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  customsBroker!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  insurance!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  label!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  invoiceTaxPercent!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  iof!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  otherExpenses!: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  lastUpdated?: string;
}

export class OfferSettingsDto {
  @ApiProperty()
  @IsString()
  defaultWarranty!: string;

  @ApiProperty()
  @IsString()
  defaultDeadline!: string;

  @ApiProperty()
  @IsString()
  defaultOfferText!: string;

  @ApiProperty()
  @IsString()
  defaultFooter!: string;

  @ApiProperty()
  @IsString()
  whatsappMessage!: string;
}

export class UserPreferencesDto {
  @ApiProperty({ enum: ['light', 'dark', 'system'] })
  @IsIn(['light', 'dark', 'system'])
  theme!: 'light' | 'dark' | 'system';

  @ApiProperty({ enum: ['pt-BR', 'en-US', 'es-PY'] })
  @IsIn(['pt-BR', 'en-US', 'es-PY'])
  language!: 'pt-BR' | 'en-US' | 'es-PY';

  @ApiProperty()
  @IsString()
  currencyFormat!: string;

  @ApiProperty()
  @IsString()
  dateFormat!: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: GeneralSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeneralSettingsDto)
  general?: GeneralSettingsDto;

  @ApiProperty({ type: FinancialSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialSettingsDto)
  financial?: FinancialSettingsDto;

  @ApiProperty({ type: ImportSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImportSettingsDto)
  importation?: ImportSettingsDto;

  @ApiProperty({ type: UsaFinancialSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UsaFinancialSettingsDto)
  usaFinancial?: UsaFinancialSettingsDto;

  @ApiProperty({ type: OfferSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferSettingsDto)
  offers?: OfferSettingsDto;

  @ApiProperty({ type: UserPreferencesDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  userPreferences?: UserPreferencesDto;
}
