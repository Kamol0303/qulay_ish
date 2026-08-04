import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, SuperAdminLoginDto } from './dto/login.dto';

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
  async login(@Body() body: LoginDto) {
    const user = await this.auth.validateUser(body.emailOrPhone, body.password);
    return this.auth.signToken(user);
  }

  @Post('super-admin/login')
  async superAdminLogin(@Body() body: SuperAdminLoginDto) {
    const login = (body.login || body.email || body.phone || '').trim();
    if (!login) throw new BadRequestException('Login majburiy');
    const user = await this.auth.superAdminLogin(login, body.password);
    return this.auth.signToken(user);
  }

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.otp.registerWithPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    return this.auth.getProfile(req.user.userId);
  }
}
