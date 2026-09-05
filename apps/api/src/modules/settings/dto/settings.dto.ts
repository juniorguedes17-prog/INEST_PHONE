import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { NonAppleElectronicsPolicy } from '../../pricing/utils/non-apple-electronics.policy';

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

export class PricingSettingsDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  offerIncrement!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(99)
  commercialRoundingEnding1!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(99)
  commercialRoundingEnding2!: number;

  @ApiProperty({ required: false, type: 'object' })
  @IsOptional()
  @IsObject()
  nonAppleElectronicsPolicy?: NonAppleElectronicsPolicy;
}

export class ResetSettingsDto {
  @ApiProperty({ required: false, enum: ['non_apple_electronics_policy'] })
  @IsOptional()
  @IsIn(['non_apple_electronics_policy'])
  target?: 'non_apple_electronics_policy';
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

export class InstallmentRateDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  installments!: number;

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(99.999999999)
  ratePercent!: number;
}

export class InstallmentProviderRatesDto {
  @ApiProperty({ type: [InstallmentRateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentRateDto)
  installments!: InstallmentRateDto[];
}

export class InfinityPayInstallmentRatesDto extends InstallmentProviderRatesDto {
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(99.999999999)
  debitRatePercent!: number;
}

export class InstallmentRatesDto {
  @ApiProperty({ type: InfinityPayInstallmentRatesDto })
  @ValidateNested()
  @Type(() => InfinityPayInstallmentRatesDto)
  infinityPay!: InfinityPayInstallmentRatesDto;

  @ApiProperty({ type: InstallmentProviderRatesDto })
  @ValidateNested()
  @Type(() => InstallmentProviderRatesDto)
  pagBank!: InstallmentProviderRatesDto;

  @ApiProperty({ type: InstallmentProviderRatesDto })
  @ValidateNested()
  @Type(() => InstallmentProviderRatesDto)
  nubank!: InstallmentProviderRatesDto;
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

  @ApiProperty({ type: PricingSettingsDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PricingSettingsDto)
  pricing?: PricingSettingsDto;

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

  @ApiProperty({ type: InstallmentRatesDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => InstallmentRatesDto)
  installmentRates?: InstallmentRatesDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  installmentMessageTemplate?: string;

  @ApiProperty({ type: UserPreferencesDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  userPreferences?: UserPreferencesDto;
}
