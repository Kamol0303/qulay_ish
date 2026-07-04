import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: { emailOrPhone: string; password: string }) {
    const user = await this.auth.validateUser(body.emailOrPhone, body.password);
    return this.auth.signToken(user);
  }

  @Post('super-admin/login')
  async superAdminLogin(@Body() body: { email: string; password: string }) {
    const user = await this.auth.superAdminLogin(body.email, body.password);
    return this.auth.signToken(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    return this.auth.getProfile(req.user.userId);
  }
}
