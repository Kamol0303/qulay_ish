import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

/** Public password registration — phone + password; only worker/employer */
export class RegisterDto {
  /** Preferred field from the auth UI */
  @ValidateIf((o: RegisterDto) => !o.phoneNumber)
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone?: string;

  @ValidateIf((o: RegisterDto) => !o.phone)
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phoneNumber?: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' })
  fullName!: string;

  @IsIn(['worker', 'employer'], { message: 'Faqat worker yoki employer roli ruxsat etiladi' })
  role!: 'worker' | 'employer';

  @IsOptional()
  @IsEmail({}, { message: 'Email noto\'g\'ri' })
  email?: string;
}
