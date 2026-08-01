import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SupplierContactQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSupplierContactDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  supplierName!: string;

  @ApiProperty({ description: 'Telefone WhatsApp em qualquer formato. O servidor persiste somente digitos.' })
  @IsString()
  whatsappNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateSupplierContactDto extends CreateSupplierContactDto {}
