import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token para invalidacao quando o cliente nao utiliza cookie HTTP Only.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
