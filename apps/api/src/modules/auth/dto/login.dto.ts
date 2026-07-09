import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@inestphone.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe@12345', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
