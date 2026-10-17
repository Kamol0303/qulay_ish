import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SAMARQAND_DISTRICT_IDS } from '../../common/samarqand-districts';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone!: string;

  /**
   * login — SMS code sign-in for an existing account
   * register — SMS code sign-up (worker only, no password)
   * reset — kept for older clients; public sign-in no longer uses a password
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

  /** Public registration is worker-only */
  @IsOptional()
  @IsIn(['worker'], { message: 'Faqat ishchilar roʻyxatdan oʻta oladi' })
  role?: 'worker';

  /** Ignored. Public sign-in is phone + SMS code only. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  /** Worker's main specialty/profession (optional, register only) */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  profession?: string;

  /** Worker's education level (optional, register only) */
  @IsOptional()
  @IsIn(['none', 'secondary', 'vocational', 'other'])
  educationLevel?: string;

  /** Optional. Public registration no longer asks for a district. */
  @IsOptional()
  @IsIn(SAMARQAND_DISTRICT_IDS as string[], {
    message: 'Tuman/shahar notoʻgʻri',
  })
  district?: string;
}
