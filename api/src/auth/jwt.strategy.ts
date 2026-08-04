import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.service';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret.trim();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-secret';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.isBlocked) {
      if (user.blockUntil && user.blockUntil > new Date()) {
        throw new UnauthorizedException('Account blocked');
      }
      if (!user.blockUntil) {
        throw new UnauthorizedException('Account blocked');
      }
    }

    // Prefer live role/email from DB over stale token claims
    return { userId: user.id, role: user.role, email: user.email };
  }
}
