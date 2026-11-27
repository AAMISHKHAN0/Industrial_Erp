import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TenantContext } from '../common/tenant/tenant-context';
import { tenantExtension } from './tenant.extension';

/**
 * PrismaService is the base client, but all model access is transparently routed
 * through a tenant-aware extended client (see tenant.extension.ts). Services keep
 * calling `this.prisma.<model>...` unchanged; the extension injects companyId.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly extended: ReturnType<PrismaClient['$extends']>;
  private readonly pool: Pool;

  constructor(tenant: TenantContext) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: Number(process.env.DB_POOL_MAX) || 30,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    this.extended = this.$extends(tenantExtension(tenant));

    // Route model/query access to the extended client while keeping lifecycle
    // hooks and the base connection on `this`.
    return new Proxy(this, {
      get: (target, prop: string | symbol, receiver) => {
        // Lifecycle + connection management stay on the base instance.
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === '$connect' ||
          prop === '$disconnect' ||
          prop === 'extended' ||
          typeof prop === 'symbol'
        ) {
          return Reflect.get(target, prop, receiver);
        }
        // Everything else (models, $transaction, $queryRaw, aggregate, etc.)
        // goes to the extended client.
        const ext: any = (target as any).extended;
        if (ext && prop in ext) {
          const value = ext[prop];
          return typeof value === 'function' ? value.bind(ext) : value;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.pool) {
      await this.pool.end().catch(() => {});
    }
  }
}
