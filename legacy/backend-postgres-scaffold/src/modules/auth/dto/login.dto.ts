import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'patient@predictdx.pk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Predictdx@123' })
  @IsString()
  password: string;
}
