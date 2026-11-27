import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a persistent session for a user with SHA-256 token digest.
   * Default validity is 24 hours (1 work shift / day).
   */
  async createSession(
    userId: string,
    ttlHours: number = 720,
  ): Promise<{ sessionToken: string; expiresAt: Date; sessionId: string }> {
    const sessionToken = this.generateToken();
    const tokenHash = this.hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
        lastActivity: new Date(),
      },
    });

    return { sessionToken, expiresAt, sessionId: session.id };
  }

  /**
   * Validates a session token against the database session store.
   * Checks expiration, revocation, and active user status.
   */
  async validateSession(sessionToken: string): Promise<any | null> {
    if (!sessionToken || typeof sessionToken !== 'string') return null;
    const tokenHash = this.hashToken(sessionToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
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
        },
      },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt <= new Date()) return null;
    if (
      !session.user ||
      session.user.status === 'DISABLED' ||
      session.user.status === 'INACTIVE'
    ) {
      return null;
    }

    // Refresh lastActivity timestamp at most once every 60s and slide expiry if < 15 days remain.
    const now = Date.now();
    const lastActivityMs = session.lastActivity
      ? new Date(session.lastActivity).getTime()
      : 0;
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const needsSlidingExtend = expiresAtMs - now < fifteenDaysMs;

    if (now - lastActivityMs > 60_000 || needsSlidingExtend) {
      const cutoff = new Date(now - 60_000);
      await this.prisma.session
        .updateMany({
          where: needsSlidingExtend
            ? { id: session.id }
            : {
                id: session.id,
                lastActivity: { lt: cutoff },
              },
          data: {
            lastActivity: new Date(now),
            ...(needsSlidingExtend ? { expiresAt: new Date(now + thirtyDaysMs) } : {}),
          },
        })
        .catch(() => {});
    }

    return session;
  }

  /**
   * Server-side session revocation: marks the session as revoked immediately.
   */
  async revokeSession(sessionToken: string): Promise<boolean> {
    if (!sessionToken || typeof sessionToken !== 'string') return false;
    const tokenHash = this.hashToken(sessionToken);

    const result = await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  /**
   * Revokes all active sessions for a given user (e.g., on password reset or account disable).
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Revokes all active sessions for a user except the current session (e.g., on change-password).
   */
  async revokeOtherUserSessions(
    userId: string,
    keepSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
