import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session || !session.user) {
      throw new UnauthorizedException('Session invalid, expired, or revoked');
    }

    const dbUser = session.user;
    if (dbUser.status === 'DISABLED' || dbUser.status === 'INACTIVE') {
      throw new UnauthorizedException('User account has been disabled');
    }

    // Flatten user permissions from roles
    const permissions = new Set<string>();
    const roles: string[] = [dbUser.role].filter(Boolean);

    if (Array.isArray(dbUser.userRoles)) {
      for (const ur of dbUser.userRoles) {
        if (ur.role) {
          if (ur.role.name && !roles.includes(ur.role.name)) {
            roles.push(ur.role.name);
          }
          if (Array.isArray(ur.role.rolePermissions)) {
            for (const rp of ur.role.rolePermissions) {
              if (rp.permission?.code) {
                permissions.add(rp.permission.code);
              }
              if (rp.permission?.name) {
                permissions.add(rp.permission.name);
              }
            }
          }
        }
      }
    }

    const authenticatedUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      roles,
      permissions: Array.from(permissions),
      companyId: dbUser.companyId,
      company: dbUser.company,
      sessionId: session.id,
    };

    (request as any).user = authenticatedUser;
    (request as any).session = session;

    return true;
  }

  private extractToken(request: Request): string | null {
    // 1. Authorization: Bearer <token>
    const authHeader = request.headers['authorization'];
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const candidate = authHeader.substring(7).trim();
      if (candidate) return candidate;
    }

    // 2. Cookie parsed by cookie-parser
    if (request.cookies) {
      if (request.cookies['session_token'])
        return request.cookies['session_token'];
      if (request.cookies['session']) return request.cookies['session'];
    }

    // 3. Fallback: Parse raw Cookie header manually
    const rawCookie = request.headers['cookie'];
    if (rawCookie && typeof rawCookie === 'string') {
      const parts = rawCookie.split(';');
      for (const part of parts) {
        const [k, ...v] = part.trim().split('=');
        if (k === 'session_token' || k === 'session') {
          return decodeURIComponent(v.join('='));
        }
      }
    }

    return null;
  }
}
