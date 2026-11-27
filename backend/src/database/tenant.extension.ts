import { Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Set of Prisma model names that are tenant-scoped (carry companyId).
 * Keep in sync with schema.prisma company relations.
 */
export const TENANT_MODELS = new Set<string>([
  'User',
  'Branch',
  'Department',
  'Designation',
  'Employee',
  'Warehouse',
  'Category',
  'Unit',
  'Item',
  'Vendor',
  'DemandNote',
  'VendorQuotation',
  'PurchaseOrder',
  'GoodsReceivingNote',
  'Customer',
  'SalesOrder',
  'BillOfMaterial',
  'ProductionOrder',
  'Account',
  'JournalEntry',
  'Payhead',
  'PayrollPeriod',
  'Notification',
  'AuditLog',
  'WarehouseStock',
  'StockLedger',
  'VendorItem',
  'IdempotencyKey',
  'AccountingPeriod',
  'Voucher',
  'FifoLayer',
  'FifoAllocation',
]);
// NOTE: Attendance and Leave are intentionally excluded — their Prisma models
// have no `companyId` column, so tenant companyId injection would fail.

// Operations whose `where` gets a companyId filter injected (READ safety net).
const READ_FILTER_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

// Operations whose `data` gets companyId assigned when missing (WRITE assignment).
const WRITE_ASSIGN_OPS = new Set(['create', 'createMany']);

const NO_MATCH = '__no_company_context__';

/**
 * COVERAGE (safety-net boundaries — see also docs in PR description):
 *  - COVERS reads:  findMany, findFirst, findFirstOrThrow, count, aggregate, groupBy
 *                   (injects where.companyId = current tenant)
 *  - COVERS writes: create, createMany (assigns data.companyId when not provided)
 *  - Applies INSIDE interactive $transaction(tx => ...) because tx derives from the extended client.
 *  - DOES NOT cover: findUnique / findUniqueOrThrow (PK lookups — verify ownership in service),
 *                    update / updateMany / upsert / delete / deleteMany (ownership verified
 *                    explicitly in services — the "hybrid" explicit layer),
 *                    $queryRaw / $executeRaw (raw SQL bypasses extensions entirely),
 *                    nested relation reads/writes inside include/select/nested create.
 *  - When there is no active request tenant store (e.g. registration, startup scripts),
 *    NOTHING is injected — those paths run unscoped by design.
 *  - When a request store exists but has no companyId and is not a bypass role, reads are
 *    forced to match nothing and tenant writes are rejected (prevents accidental global access).
 */
export function tenantExtension(tenant: TenantContext) {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const store = tenant.store;

          // No request context (background/registration) or explicit bypass → run as-is.
          if (!store || store.bypass) return query(args);
          if (!TENANT_MODELS.has(model)) return query(args);

          const companyId = store.companyId;

          if (READ_FILTER_OPS.has(operation)) {
            const a: any = args ?? {};
            a.where = { ...(a.where ?? {}), companyId: companyId ?? NO_MATCH };
            return query(a);
          }

          if (WRITE_ASSIGN_OPS.has(operation)) {
            if (!companyId) {
              throw new ForbiddenException(
                'Cannot create tenant record without company context',
              );
            }
            const a: any = args ?? {};
            if (operation === 'createMany') {
              const data = Array.isArray(a.data) ? a.data : [a.data];
              a.data = data.map((d: any) => ({ companyId, ...d }));
            } else {
              a.data = { companyId, ...(a.data ?? {}) };
            }
            return query(a);
          }

          // Uncovered ops (findUnique/update/delete/upsert/raw) — pass through.
          return query(args);
        },
      },
    },
  });
}
