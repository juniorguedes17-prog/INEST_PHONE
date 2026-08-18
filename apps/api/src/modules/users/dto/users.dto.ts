import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreateAdministratorDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
