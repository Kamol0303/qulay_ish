import { IsIn, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

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

  /** Public registration may only choose worker or employer */
  @IsOptional()
  @IsIn(['worker', 'employer'], { message: 'Faqat worker yoki employer roli ruxsat etiladi' })
  role?: 'worker' | 'employer';

  /** Required when purpose=register — hashed server-side, never stored plaintext */
  @ValidateIf((o: SendOtpDto) => o.purpose === 'register')
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  password?: string;
}
