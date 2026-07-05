import { IsEnum, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone!: string;

  /** Ro'yxatdan o'tish uchun — spec asosiy maydoni `phone`, qolganlari ixtiyoriy */
  @IsOptional()
  @IsIn(['login', 'register'])
  purpose?: 'login' | 'register';

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
