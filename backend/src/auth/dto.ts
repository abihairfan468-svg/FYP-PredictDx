import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** At least 8 characters with upper case, lower case, a digit and a symbol. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
export const PASSWORD_MESSAGE =
  'Password needs 8+ characters with an upper-case letter, a lower-case letter, a number and a symbol';

export class RegisterDto {
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR'] })
  @IsIn(['PATIENT', 'DOCTOR'], { message: 'Administrator accounts are created by the system only' })
  role!: 'PATIENT' | 'DOCTOR';

  @ApiProperty() @Transform(trim) @IsString() @Length(3, 80) fullName!: string;
  @ApiProperty() @Transform(lower) @IsEmail({}, { message: 'Enter a valid e-mail address' }) email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9 -]{10,16}$/, { message: 'Enter a valid phone number, e.g. +92 300 1234567' })
  phone?: string;

  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password!: string;

  // ---- patient-only
  @ApiPropertyOptional() @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @MaxLength(40) city?: string;

  // ---- doctor-only (required when role = DOCTOR)
  @ValidateIf((o) => o.role === 'DOCTOR') @Transform(trim) @IsNotEmpty() @MaxLength(60) specialization?: string;
  @ValidateIf((o) => o.role === 'DOCTOR')
  @Transform(trim)
  @Matches(/^[0-9A-Za-z-]{4,12}$/, { message: 'Enter your PMDC registration number' })
  pmdcNumber?: string;
  @ValidateIf((o) => o.role === 'DOCTOR') @Transform(trim) @IsNotEmpty() @MaxLength(80) qualification?: string;
  @ValidateIf((o) => o.role === 'DOCTOR') @Transform(trim) @IsNotEmpty() @MaxLength(100) hospital?: string;
  @ValidateIf((o) => o.role === 'DOCTOR') @Type(() => Number) @IsInt() @Min(0) @Max(100000) fee?: number;
}

export class LoginDto {
  @ApiProperty() @Transform(lower) @IsEmail({}, { message: 'Enter a valid e-mail address' }) email!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(72) password!: string;
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR', 'ADMIN'] }) @IsIn(['PATIENT', 'DOCTOR', 'ADMIN']) role!: string;
}

export class VerifyEmailDto {
  @ApiProperty() @Transform(lower) @IsEmail() email!: string;
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' }) code!: string;
}

export class MfaVerifyDto {
  @ApiProperty() @IsString() @IsNotEmpty() mfaToken!: string;
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' }) code!: string;
}

export class ResendDto {
  @ApiProperty({ enum: ['VERIFY_EMAIL', 'LOGIN_MFA', 'RESET_PASSWORD'] })
  @IsIn(['VERIFY_EMAIL', 'LOGIN_MFA', 'RESET_PASSWORD'])
  purpose!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(lower) @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mfaToken?: string;
}

export class ForgotDto {
  @ApiProperty() @Transform(lower) @IsEmail() email!: string;
}

export class ResetDto {
  @ApiProperty() @Transform(lower) @IsEmail() email!: string;
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' }) code!: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() currentPassword!: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(3, 80) fullName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9 -]{10,16}$/, { message: 'Enter a valid phone number' })
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @MaxLength(40) city?: string;
}

export class MfaToggleDto {
  @ApiProperty() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() enabled!: boolean;
}

export class TotpCodeDto {
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator app' }) code!: string;
}
