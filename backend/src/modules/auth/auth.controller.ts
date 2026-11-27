import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseAuthGuard } from './strategies/supabase.strategy';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { AuthService } from './auth.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { BootstrapDto } from './dto/bootstrap.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Returns list of configured accounts for local desktop recovery (email & role).
   */
  @Get('recovery-accounts')
  async getRecoveryAccounts() {
    return this.authService.getRecoveryAccounts();
  }

  /**
   * Offline password reset for local desktop installation without email dispatch.
   */
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.offlineResetPassword(dto);
  }

  /**
   * Authenticated password change from Settings -> Security.
   */
  @Post('change-password')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  async changePassword(
    @GetUser('id') userId: string,
    @GetUser('sessionId') sessionId: string | undefined,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, sessionId, dto);
  }

  /**
   * Health/Readiness status of system initialization.
   */
  @Get('bootstrap/status')
  async getBootstrapStatus() {
    return this.authService.getBootstrapStatus();
  }

  /**
   * One-time initial setup creating company and first owner user.
   */
  @Post('bootstrap')
  @HttpCode(201)
  async bootstrap(
    @Body() dto: BootstrapDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.bootstrap(dto);

    // Set HttpOnly cookie for session token
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });

    return result;
  }

  /**
   * Local credential authentication with Argon2id and rate-limiting.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Set HttpOnly cookie for session token
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });

    return result;
  }

  /**
   * Server-side session invalidation and cookie clearance.
   */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    if (!token && req.cookies) {
      token = req.cookies['session_token'] || req.cookies['session'] || null;
    }
    if (!token && req.headers.cookie) {
      const parts = req.headers.cookie.split(';');
      for (const part of parts) {
        const [k, ...v] = part.trim().split('=');
        if (k === 'session_token' || k === 'session') {
          token = decodeURIComponent(v.join('='));
          break;
        }
      }
    }

    if (token) {
      await this.authService.logout(token).catch(() => {});
    }

    const cookieClearOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
    };
    res.clearCookie('session_token', cookieClearOptions);
    res.clearCookie('session', cookieClearOptions);

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Returns current authenticated user and session info.
   */
  @Get('session')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async getSession(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async getMe(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('users')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async listUsers(@GetUser('companyId') companyId: string) {
    return this.authService.listUsers(companyId);
  }

  @Post('users')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async createUser(
    @GetUser('companyId') companyId: string,
    @GetUser('role') currentRole: string,
    @Body() dto: any,
  ) {
    return this.authService.createUser(companyId, currentRole, dto);
  }

  @Patch('users/:id')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async updateUser(
    @Param('id') userId: string,
    @GetUser('companyId') companyId: string,
    @GetUser('role') currentRole: string,
    @Body() dto: any,
  ) {
    return this.authService.updateUser(userId, companyId, currentRole, dto);
  }

  @Delete('users/:id')
  @UseGuards(SessionAuthGuard)
  @ApiBearerAuth()
  async deleteUser(
    @Param('id') userId: string,
    @GetUser('companyId') companyId: string,
    @GetUser('id') currentUserId: string,
    @GetUser('role') currentRole: string,
  ) {
    return this.authService.deleteUser(
      userId,
      companyId,
      currentUserId,
      currentRole,
    );
  }

  @Post('register-company')
  @HttpCode(201)
  async registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.authService.registerCompany(dto);
  }

  @Post('sync')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  async syncUser(@GetUser() user: { id: string; email: string }) {
    return this.authService.syncUser(user);
  }

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  async getProfile(@GetUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
