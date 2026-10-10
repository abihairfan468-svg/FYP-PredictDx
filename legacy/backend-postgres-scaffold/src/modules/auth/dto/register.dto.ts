import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'abiha@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Abiha Irfan' })
  @IsString()
  @MinLength(3)
  fullName: string;

  @ApiProperty({ example: 'Predictdx@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password needs an uppercase letter, a lowercase letter and a digit',
  })
  password: string;

  @ApiProperty({ required: false, example: '+923001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, enum: Role, default: Role.PATIENT })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
