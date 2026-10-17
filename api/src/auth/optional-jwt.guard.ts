import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Public routes stay open. A valid bearer token still identifies staff. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
    if (!req.headers?.authorization) return true;
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }

  handleRequest<T>(_err: unknown, user: T): T | null {
    return user || null;
  }
}
