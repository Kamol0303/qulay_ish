import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat boʻlishi kerak' })
  fullName!: string;

  /** Login — Uzbekistan phone in +998XXXXXXXXX form */
  @Matches(/^\+998\d{9}$/, {
    message: 'Telefon raqami +998XXXXXXXXX formatida boʻlishi kerak',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgidan iborat boʻlishi kerak' })
  password!: string;

  /** Which staff role to grant. Defaults to admin. */
  @IsOptional()
  @IsIn(['admin', 'super_admin'], { message: 'Rol admin yoki super_admin boʻlishi kerak' })
  role?: 'admin' | 'super_admin';

  @IsOptional()
  @IsString()
  email?: string;
}
