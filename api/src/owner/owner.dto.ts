import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OwnerFormDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  confirm?: string;
}
