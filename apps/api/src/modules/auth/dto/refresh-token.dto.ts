import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token para clientes que nao utilizam cookie HTTP Only.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
