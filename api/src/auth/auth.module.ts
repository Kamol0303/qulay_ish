import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { DevSmsService } from './devsms.service';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret.trim();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-secret';
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: resolveJwtSecret(),
      // Long-lived session so users stay logged in across reloads (override via JWT_EXPIRES_IN)
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, DevSmsService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
