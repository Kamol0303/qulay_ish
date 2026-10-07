import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { SAMARQAND_DISTRICT_IDS } from '../../common/samarqand-districts';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone!: string;

  /**
   * login — legacy OTP login (discouraged; use password)
   * register — legacy OTP register (discouraged; use password register)
   * reset — password recovery (SMS OTP only for this purpose)
   */
  @IsOptional()
  @IsIn(['login', 'register', 'reset'])
  purpose?: 'login' | 'register' | 'reset';

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' })
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  /** Public registration may only choose worker or employer */
  @IsOptional()
  @IsIn(['worker', 'employer'], { message: 'Faqat worker yoki employer roli ruxsat etiladi' })
  role?: 'worker' | 'employer';

  /** Required when purpose=register — hashed server-side, never stored plaintext */
  @ValidateIf((o: SendOtpDto) => o.purpose === 'register')
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  password?: string;

  /** Worker's main specialty/profession (optional, register only) */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  profession?: string;

  /** Worker's education level (optional, register only) */
  @IsOptional()
  @IsIn(['secondary', 'vocational', 'bachelor', 'master', 'phd', 'other'])
  educationLevel?: string;

  /**
   * Samarqand district/city the account belongs to. Required for public
   * registration (worker AND buyurtmachi) — it fixes exactly where the user is
   * so we can match nearby workers and jobs.
   */
  @ValidateIf((o: SendOtpDto) => o.purpose === 'register')
  @IsIn(SAMARQAND_DISTRICT_IDS as string[], {
    message: 'Tuman/shaharni roʻyxatdan tanlang',
  })
  district?: string;
}
