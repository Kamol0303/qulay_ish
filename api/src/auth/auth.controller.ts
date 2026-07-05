import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

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

  @Post('otp/request')
  async requestOtp(
    @Body()
    body: {
      phoneOrEmail: string;
      purpose: 'login' | 'register';
      fullName?: string;
      role?: UserRole;
      channel?: 'sms' | 'email';
    },
  ) {
    return this.otp.requestOtp(body);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() body: { sessionId: string; otp: string }) {
    return this.otp.verifyOtp(body.sessionId, body.otp);
  }

  @Post('otp/complete-registration')
  async completeRegistration(
    @Body() body: { sessionId: string; email?: string; phoneNumber?: string },
  ) {
    return this.otp.completeRegistration(body.sessionId, body);
  }

  @Post('otp/complete-login')
  async completeLogin(@Body() body: { sessionId: string }) {
    return this.otp.completeLogin(body.sessionId);
  }

  @Post('register')
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      fullName: string;
      role: UserRole;
      phoneNumber?: string;
    },
  ) {
    return this.otp.registerWithPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    return this.auth.getProfile(req.user.userId);
  }
}
