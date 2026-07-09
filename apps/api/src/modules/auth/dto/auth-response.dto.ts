import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  expiresIn!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: AuthTokensDto })
  tokens!: AuthTokensDto;
}
