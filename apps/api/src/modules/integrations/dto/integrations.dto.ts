import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ImportIntegrationDto {
  @ApiProperty({ enum: ['csv', 'excel', 'google_sheets'] })
  @IsIn(['csv', 'excel', 'google_sheets'])
  source!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}

export class ExportIntegrationDto {
  @ApiProperty({ enum: ['csv', 'excel', 'pdf'] })
  @IsIn(['csv', 'excel', 'pdf'])
  format!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataset?: string;
}

export class WhatsappMessageDto {
  @ApiProperty()
  @IsString()
  message!: string;
}
