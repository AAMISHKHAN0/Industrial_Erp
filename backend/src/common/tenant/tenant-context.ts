import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  companyId: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  role?: string | null;
  /** When true, the Prisma tenant extension does not inject/enforce companyId (platform admin / system tasks). */
  bypass?: boolean;
}

@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  get store(): TenantStore | undefined {
    return this.als.getStore();
  }

  get companyId(): string | null {
    return this.als.getStore()?.companyId ?? null;
  }

  get bypass(): boolean {
    return this.als.getStore()?.bypass ?? false;
  }
}
