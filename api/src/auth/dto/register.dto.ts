import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Public password registration — only worker/employer */
export class RegisterDto {
  @IsEmail({}, { message: 'Email noto\'g\'ri' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' })
  fullName!: string;

  @IsIn(['worker', 'employer'], { message: 'Faqat worker yoki employer roli ruxsat etiladi' })
  role!: 'worker' | 'employer';

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phoneNumber?: string;
}
