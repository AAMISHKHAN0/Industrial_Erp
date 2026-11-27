import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Resolves the tenant company id from the authenticated user.
 * The backend is authoritative: companyId comes from the local user record
 * (attached by SupabaseStrategy.validate), never from client input.
 *
 * Throws 403 if the authenticated user has no company (e.g. platform super-admin
 * or an unlinked account) so tenant-scoped endpoints cannot leak global data.
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const companyId = request.user?.companyId;
    if (!companyId) {
      throw new ForbiddenException('No company context for this user');
    }
    return companyId;
  },
);

/** Non-throwing variant: returns companyId or null (for endpoints that tolerate no tenant). */
export const OptionalCompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.companyId ?? null;
  },
);
