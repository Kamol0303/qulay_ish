import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.otp.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otp.verifyOtpByPhone(dto);
  }

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
