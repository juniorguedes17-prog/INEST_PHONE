import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { MINIMUM_PASSWORD_LENGTH } from '../constants/auth.constants';

export class LoginDto {
  @ApiProperty({ example: 'admin@inestphone.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe@12345', minLength: MINIMUM_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MINIMUM_PASSWORD_LENGTH)
  password!: string;
}
