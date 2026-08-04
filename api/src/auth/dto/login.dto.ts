import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3, { message: 'Email yoki telefon majburiy' })
  emailOrPhone!: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  password!: string;
}

export class SuperAdminLoginDto {
  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
