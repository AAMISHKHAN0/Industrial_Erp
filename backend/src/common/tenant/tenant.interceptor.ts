import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';

/**
 * Populates the AsyncLocalStorage tenant store for the lifetime of each request,
 * using the companyId/role resolved by SupabaseStrategy.validate() onto req.user.
 * Runs the downstream handler INSIDE als.run so Prisma's tenant extension can read it.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    const store = {
      companyId: user?.companyId ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      userName: user?.name ?? null,
      role: user?.role ?? null,
      // Platform owner or unauthenticated public requests bypass tenant filtering.
      bypass: user?.role === 'PLATFORM_OWNER' || !user,
    };
    return this.tenant.run(store, () => next.handle());
  }
}
