import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../session.service';

/**
 * Auth guard supporting offline local session tokens (primary) and Supabase JWTs (legacy cloud fallback).
 * All dev-mode bypasses have been completely removed.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private sessionService: SessionService,
  ) {
    const url = config.get<string>('SUPABASE_URL');
    const anonKey = config.get<string>('SUPABASE_ANON_KEY');
    if (url && anonKey) {
      try {
        this.supabase = createClient(url, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      } catch {
        this.supabase = null;
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Extract token from Authorization header or Cookie
    let token: string | null = null;
    const authHeader: string = request.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
    if (!token && request.cookies) {
      token =
        request.cookies['session_token'] || request.cookies['session'] || null;
    }
    if (!token && request.headers.cookie) {
      const parts = request.headers.cookie.split(';');
      for (const part of parts) {
        const [k, ...v] = part.trim().split('=');
        if (k === 'session_token' || k === 'session') {
          token = decodeURIComponent(v.join('='));
          break;
        }
      }
    }

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    // 2. Primary: Validate local DB session token
    const localSession = await this.sessionService.validateSession(token);
    if (localSession && localSession.user) {
      const dbUser = localSession.user;
      if (dbUser.status === 'DISABLED' || dbUser.status === 'INACTIVE') {
        throw new UnauthorizedException('User account has been disabled');
      }

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
                if (rp.permission?.code) permissions.add(rp.permission.code);
                if (rp.permission?.name) permissions.add(rp.permission.name);
              }
            }
          }
        }
      }

      request.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        roles,
        permissions: Array.from(permissions),
        companyId: dbUser.companyId,
        company: dbUser.company,
        sessionId: localSession.id,
        aud: 'authenticated',
        supabaseRole: 'authenticated',
      };
      request.session = localSession;

      return true;
    }

    // 3. Fallback: Verify via Supabase only for cloud JWTs when not in local desktop mode
    const isJwt = token.split('.').length === 3;
    const isLocalDesktop = process.env.LOCAL_DESKTOP_MODE === 'true';
    if (this.supabase && !isLocalDesktop && isJwt) {
      try {
        const { data, error } = await this.supabase.auth.getUser(token);
        if (!error && data?.user) {
          const userId = data.user.id;
          const email = data.user.email;

          const resolveCompany = async () => {
            let comp = await this.prisma.company.findFirst({
              orderBy: { createdAt: 'asc' },
            });
            if (!comp)
              comp = await this.prisma.company.create({
                data: {
                  name: 'Default Company',
                  email: 'admin@textileerp.com',
                },
              });
            return comp;
          };

          const metaRole = (data.user.app_metadata?.role as string) || '';
          const mappedRole =
            metaRole === 'admin'
              ? 'ADMIN'
              : metaRole === 'manager'
                ? 'MANAGER'
                : metaRole === 'staff'
                  ? 'STAFF'
                  : '';

          let effectiveRole: string;
          let effectiveCompanyId: string;

          const localUser = await this.prisma.user.findFirst({
            where: { OR: [{ id: userId }, { firebaseUid: userId }, { email }] },
            select: { id: true, companyId: true, role: true },
          });

          if (localUser) {
            effectiveCompanyId = localUser.companyId;
            effectiveRole = localUser.role;
          } else {
            const comp = await resolveCompany();
            const created = await this.prisma.user.create({
              data: {
                id: userId,
                email: email || 'user@example.com',
                role: mappedRole || 'MEMBER',
                status: 'ACTIVE',
                companyId: comp.id,
              },
            });
            effectiveRole = created.role;
            effectiveCompanyId = comp.id;
          }

          request.user = {
            id: userId,
            email,
            aud: 'authenticated',
            supabaseRole: 'authenticated',
            companyId: effectiveCompanyId ?? null,
            role: effectiveRole ?? 'MEMBER',
            roles: [effectiveRole ?? 'MEMBER'],
            permissions: [],
          };

          return true;
        }
      } catch {
        // Fall through
      }
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
