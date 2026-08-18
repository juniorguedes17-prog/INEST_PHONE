import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MINIMUM_PASSWORD_LENGTH } from '../../auth/constants/auth.constants';

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
  @MinLength(MINIMUM_PASSWORD_LENGTH)
  password!: string;
}

export class UpdateAdministratorDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @ApiProperty({ required: false, minLength: MINIMUM_PASSWORD_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(MINIMUM_PASSWORD_LENGTH)
  password?: string;
}
