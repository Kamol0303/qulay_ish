import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' })
  newPassword!: string;
}
