import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GuestDto } from './dto/guest.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestWithUser } from '../common/types/request-with-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('guest')
  guest(@Body() payload: GuestDto) {
    return this.authService.guestLogin(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  session(@Req() req: RequestWithUser) {
    return this.authService.session(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Req() req: RequestWithUser,
    @Body() payload: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, payload);
  }
}
