import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP kodi 6 raqamli bo\'lishi kerak' })
  code!: string;
}
