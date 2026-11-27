import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { BootstrapDto } from './dto/bootstrap.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { seedDefaultAccounts } from '../finance/account/default-accounts';

interface AttemptTracker {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService {
  private admin: SupabaseClient | null = null;
  private loginAttempts = new Map<string, AttemptTracker>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private tenant: TenantContext,
    private passwordService: PasswordService,
    private sessionService: SessionService,
  ) {}

  private getAdminClient(): SupabaseClient | null {
    if (this.admin) return this.admin;
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return null;
    }
    try {
      this.admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return this.admin;
    } catch {
      return null;
    }
  }

  /**
   * Status check for one-time setup bootstrap.
   */
  async getBootstrapStatus(): Promise<{
    initialized: boolean;
    canBootstrap: boolean;
    userCount: number;
  }> {
    const countResult = await this.prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*)::int as count FROM users`;
    const userCount = Number(countResult[0]?.count || 0);
    return {
      initialized: userCount > 0,
      canBootstrap: userCount === 0,
      userCount,
    };
  }

  /**
   * One-time initial local administrator setup (bootstrap).
   * Atomically provisions company, owner user, default department, roles, permissions, and chart of accounts.
   * Permanently disabled once user count > 0.
   */
  async bootstrap(dto: BootstrapDto) {
    const countResult = await this.prisma.$queryRaw<
      { count: number }[]
    >`SELECT COUNT(*)::int as count FROM users`;
    const userCount = Number(countResult[0]?.count || 0);
    if (userCount > 0) {
      throw new ConflictException(
        'System is already bootstrapped. Initial setup can only be executed once.',
      );
    }

    this.passwordService.validatePasswordStrength(dto.password);
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const email = dto.adminEmail.toLowerCase().trim();

    const result = await this.tenant.run(
      { companyId: null, bypass: true },
      () =>
        this.prisma.$transaction(async (tx) => {
          // Concurrency guard: Serialize concurrent bootstrap attempts via transaction advisory lock
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('erp_system_bootstrap_lock'))`;
          const atomicCountResult = await tx.$queryRaw<
            { count: number }[]
          >`SELECT COUNT(*)::int as count FROM users`;
          const atomicUserCount = Number(atomicCountResult[0]?.count || 0);
          if (atomicUserCount > 0) {
            throw new ConflictException(
              'System is already bootstrapped. Initial setup can only be executed once.',
            );
          }

          // 1. Create company
          const company = await tx.company.create({
            data: {
              name: dto.companyName,
              email,
              phone: dto.phone || null,
              address: dto.address || null,
              taxNumber: dto.taxNumber || null,
              status: 'ACTIVE',
            },
          });

          // 2. Create Owner User
          const user = await tx.user.create({
            data: {
              companyId: company.id,
              role: 'OWNER',
              email,
              password: passwordHash,
              status: 'ACTIVE',
              isEmailVerified: true,
            },
            select: { id: true, email: true, role: true, companyId: true },
          });

          // 3. Create General department
          await tx.department.create({
            data: { companyId: company.id, name: 'General', status: 'ACTIVE' },
          });

          // 4. Seed system roles
          const rolesData = [
            { name: 'OWNER', description: 'Full system owner', isSystem: true },
            {
              name: 'ADMIN',
              description: 'System administrator',
              isSystem: true,
            },
            {
              name: 'MANAGER',
              description: 'Department manager',
              isSystem: true,
            },
            {
              name: 'STAFF',
              description: 'Regular staff member',
              isSystem: true,
            },
            { name: 'MEMBER', description: 'Basic member', isSystem: true },
          ];

          const roleMap: Record<string, string> = {};
          for (const r of rolesData) {
            let role = await tx.role.findUnique({ where: { name: r.name } });
            if (!role) {
              role = await tx.role.create({ data: r });
            }
            roleMap[r.name] = role.id;
          }

          // 5. Seed default permissions
          const modules = [
            'master-data',
            'inventory',
            'warehouse',
            'purchase',
            'sales',
            'production',
            'finance',
            'hr',
            'reports',
            'settings',
            'users',
            'roles',
            'backups',
          ];
          const actions = ['create', 'read', 'update', 'delete'];
          const permMap: Record<string, string> = {};

          for (const mod of modules) {
            for (const action of actions) {
              const name = `${mod}:${action}`;
              const code = name.toUpperCase().replace(/-/g, '_');
              let perm = await tx.permission.findUnique({ where: { code } });
              if (!perm) {
                perm = await tx.permission.create({
                  data: {
                    name,
                    code,
                    module: mod,
                    description: `${action} ${mod}`,
                  },
                });
              }
              permMap[name] = perm.id;
            }
          }

          // 6. Assign all permissions to OWNER role
          const allPermIds = Object.values(permMap);
          for (const permId of allPermIds) {
            const exists = await tx.rolePermission.findFirst({
              where: { roleId: roleMap['OWNER'], permissionId: permId },
            });
            if (!exists) {
              await tx.rolePermission.create({
                data: { roleId: roleMap['OWNER'], permissionId: permId },
              });
            }
          }

          // Assign to ADMIN (except backups and roles)
          const adminPerms = allPermIds.filter((id) => {
            const permName =
              Object.entries(permMap).find(([, v]) => v === id)?.[0] || '';
            return (
              !permName.startsWith('backups:') && !permName.startsWith('roles:')
            );
          });
          for (const permId of adminPerms) {
            const exists = await tx.rolePermission.findFirst({
              where: { roleId: roleMap['ADMIN'], permissionId: permId },
            });
            if (!exists) {
              await tx.rolePermission.create({
                data: { roleId: roleMap['ADMIN'], permissionId: permId },
              });
            }
          }

          // Assign to MANAGER
          const managerPermNames = modules
            .filter(
              (m) => !['users', 'roles', 'backups', 'settings'].includes(m),
            )
            .flatMap((m) =>
              actions.filter((a) => a !== 'delete').map((a) => `${m}:${a}`),
            );
          for (const permName of managerPermNames) {
            if (permMap[permName]) {
              const exists = await tx.rolePermission.findFirst({
                where: {
                  roleId: roleMap['MANAGER'],
                  permissionId: permMap[permName],
                },
              });
              if (!exists) {
                await tx.rolePermission.create({
                  data: {
                    roleId: roleMap['MANAGER'],
                    permissionId: permMap[permName],
                  },
                });
              }
            }
          }

          // Assign to STAFF
          const staffPermNames = modules
            .filter(
              (m) => !['users', 'roles', 'backups', 'settings'].includes(m),
            )
            .flatMap((m) => ['read'].map((a) => `${m}:${a}`));
          for (const permName of staffPermNames) {
            if (permMap[permName]) {
              const exists = await tx.rolePermission.findFirst({
                where: {
                  roleId: roleMap['STAFF'],
                  permissionId: permMap[permName],
                },
              });
              if (!exists) {
                await tx.rolePermission.create({
                  data: {
                    roleId: roleMap['STAFF'],
                    permissionId: permMap[permName],
                  },
                });
              }
            }
          }

          // 7. Assign OWNER role to the admin user
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleMap['OWNER'],
            },
          });

          // 8. Seed default accounts
          await seedDefaultAccounts(tx, company.id, user.id);

          return { company, user };
        }),
    );

    // 9. Generate active session
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      result.user.id,
    );

    return {
      company: result.company,
      user: {
        ...result.user,
        roles: ['OWNER'],
      },
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Local login with Argon2id password verification and progressive throttling.
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    this.checkThrottling(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        company: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.password) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'DISABLED' || user.status === 'INACTIVE') {
      throw new UnauthorizedException(
        'Account has been deactivated. Please contact your administrator.',
      );
    }

    const isValidPassword = await this.passwordService.verifyPassword(
      user.password,
      dto.password,
    );
    if (!isValidPassword) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Success — clear failed attempts
    this.loginAttempts.delete(email);

    // Update user login metrics
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });

    // Create session
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      user.id,
    );

    // Collect roles & permissions
    const permissions = new Set<string>();
    const roles: string[] = [user.role].filter(Boolean);
    if (Array.isArray(user.userRoles)) {
      for (const ur of user.userRoles) {
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

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roles,
        permissions: Array.from(permissions),
        companyId: user.companyId,
        company: user.company,
      },
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Server-side session logout.
   */
  async logout(sessionToken: string) {
    if (sessionToken) {
      await this.sessionService.revokeSession(sessionToken);
    }
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Retrieves current authenticated user profile and permissions.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = new Set<string>();
    const roles: string[] = [user.role].filter(Boolean);
    if (Array.isArray(user.userRoles)) {
      for (const ur of user.userRoles) {
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

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles,
      permissions: Array.from(permissions),
      companyId: user.companyId,
      company: user.company,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Throttling management: checks if the account/email is locked due to repeated failures.
   */
  private checkThrottling(email: string): void {
    const tracker = this.loginAttempts.get(email);
    if (!tracker) return;

    if (tracker.lockedUntil && Date.now() < tracker.lockedUntil) {
      const remainingSeconds = Math.ceil(
        (tracker.lockedUntil - Date.now()) / 1000,
      );
      throw new HttpException(
        `Too many consecutive failed login attempts. Account temporarily throttled. Please try again in ${remainingSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Lock expired, reset lock
    if (tracker.lockedUntil && Date.now() >= tracker.lockedUntil) {
      tracker.lockedUntil = undefined;
    }
  }

  private recordFailedAttempt(email: string): void {
    let tracker = this.loginAttempts.get(email);
    const now = Date.now();

    if (!tracker || now - tracker.lastAttempt > 15 * 60 * 1000) {
      tracker = { count: 1, lastAttempt: now };
    } else {
      tracker.count++;
      tracker.lastAttempt = now;
    }

    // 5 consecutive failures triggers progressive lock
    if (tracker.count >= 5) {
      const lockSeconds = Math.min(300, 30 * Math.pow(2, tracker.count - 5)); // 30s, 60s, 120s...
      tracker.lockedUntil = now + lockSeconds * 1000;
    }

    this.loginAttempts.set(email, tracker);
  }

  /**
   * Returns list of configured accounts on this local installation for password recovery.
   */
  async getRecoveryAccounts() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        company: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      count: users.length,
      accounts: users.map((u) => ({
        email: u.email,
        role: u.role,
        companyName: u.company?.name || 'Enterprise Workspace',
      })),
    };
  }

  /**
   * Offline password reset for local desktop installation without email dispatch.
   */
  async offlineResetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    this.passwordService.validatePasswordStrength(dto.newPassword);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      throw new NotFoundException(`No account found for email: ${email}`);
    }

    const hashedPassword = await this.passwordService.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    // Revoke old sessions
    await this.sessionService.revokeAllUserSessions(user.id);

    // Reset login throttling tracker if any
    this.loginAttempts.delete(email);

    return {
      success: true,
      message: 'Password updated successfully. You can now log in with your new password.',
      email: user.email,
    };
  }

  /**
   * Authenticated password change for Settings -> Security tab.
   */
  async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid user account');
    }

    const isCurrentValid = await this.passwordService.verifyPassword(
      user.password,
      dto.currentPassword,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    this.passwordService.validatePasswordStrength(dto.newPassword);
    const hashedPassword = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    await this.sessionService.revokeOtherUserSessions(user.id, currentSessionId);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  /**
   * Legacy registerCompany flow, updated to also work offline if Supabase is not configured.
   */
  async registerCompany(dto: RegisterCompanyDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });
    if (existing)
      throw new BadRequestException(
        'An account with this email already exists',
      );

    const admin = this.getAdminClient();
    let supabaseUserId: string | null = null;

    if (admin) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: dto.ownerEmail,
        password: dto.password,
        email_confirm: true,
        user_metadata: { name: dto.ownerName },
      });
      if (error || !created?.user) {
        throw new BadRequestException(
          `Failed to create auth user: ${error?.message ?? 'unknown error'}`,
        );
      }
      supabaseUserId = created.user.id;
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    try {
      return await this.tenant.run({ companyId: null, bypass: true }, () =>
        this.prisma.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: {
              name: dto.companyName,
              email: dto.companyEmail,
              phone: dto.companyPhone,
              address: dto.address,
              taxNumber: dto.taxNumber,
              status: 'ACTIVE',
            },
          });

          const user = await tx.user.create({
            data: {
              ...(supabaseUserId ? { id: supabaseUserId } : {}),
              companyId: company.id,
              role: 'OWNER',
              email: dto.ownerEmail,
              password: passwordHash,
              firebaseUid: supabaseUserId,
              status: 'ACTIVE',
              isEmailVerified: true,
            },
            select: { id: true, email: true, role: true, companyId: true },
          });

          await tx.department.create({
            data: { companyId: company.id, name: 'General', status: 'ACTIVE' },
          });

          await seedDefaultAccounts(tx, company.id, user.id);

          return { company: { id: company.id, name: company.name }, user };
        }),
      );
    } catch (e) {
      if (admin && supabaseUserId) {
        await admin.auth.admin
          .deleteUser(supabaseUserId)
          .catch(() => undefined);
      }
      throw new InternalServerErrorException(
        'Company provisioning failed; registration rolled back',
      );
    }
  }

  async syncUser(user: { id: string; email: string }) {
    const dbUser = await this.prisma.user.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email }] },
    });

    if (dbUser) {
      await this.prisma.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return { synced: true };
  }

  async listUsers(companyId?: string) {
    const where = companyId ? { companyId } : {};
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.role || 'staff').toLowerCase(),
      fullName: u.email.split('@')[0],
      pages: [],
      confirmed: u.status === 'ACTIVE',
      createdAt: u.createdAt,
    }));
  }

  async createUser(companyId: string, currentRole: string, dto: any) {
    const roleNormalized = (currentRole || '').toUpperCase();
    if (roleNormalized !== 'OWNER' && roleNormalized !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage users');
    }

    const email = String(dto.email || '').toLowerCase().trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('A valid email is required');
    }

    const password = String(dto.password || '');
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const targetRole = String(dto.role || 'STAFF').toUpperCase();
    const passwordHash = await this.passwordService.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: targetRole,
        companyId,
        status: 'ACTIVE',
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: (user.role || 'staff').toLowerCase(),
        fullName: String(dto.fullName || email.split('@')[0]),
        pages: Array.isArray(dto.pages) ? dto.pages : [],
        confirmed: true,
        createdAt: user.createdAt,
      },
    };
  }

  async updateUser(userId: string, companyId: string, currentRole: string, dto: any) {
    const roleNormalized = (currentRole || '').toUpperCase();
    if (roleNormalized !== 'OWNER' && roleNormalized !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage users');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const targetRole = dto.role ? String(dto.role).toUpperCase() : user.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: targetRole },
      select: { id: true, email: true, role: true, status: true, createdAt: true },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: (updated.role || 'staff').toLowerCase(),
    };
  }

  async deleteUser(userId: string, companyId: string, currentUserId: string, currentRole: string) {
    const roleNormalized = (currentRole || '').toUpperCase();
    if (roleNormalized !== 'OWNER' && roleNormalized !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can manage users');
    }

    if (userId === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.user.delete({ where: { id: userId } });

    return { success: true, message: 'User deleted' };
  }
}
