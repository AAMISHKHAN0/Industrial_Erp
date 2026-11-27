import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SupabaseAuthGuard } from './strategies/supabase.strategy';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SupabaseAuthGuard,
    SessionAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    SupabaseAuthGuard,
    SessionAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
