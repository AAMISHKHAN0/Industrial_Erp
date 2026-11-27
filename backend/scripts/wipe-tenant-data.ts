/**
 * Wipes all business/tenant data so companyId can be made NOT NULL.
 * Safe here: no real customer data yet. Run: npx ts-node scripts/wipe-tenant-data.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const TABLES = [
  'pay_slip_items', 'pay_slips', 'payroll_periods', 'payheads',
  'journal_entry_items', 'journal_entries', 'accounts',
  'stock_ledger', 'warehouse_stock',
  'quality_checks', 'material_consumptions', 'production_orders',
  'bom_materials', 'bill_of_materials',
  'sales_order_items', 'sales_orders', 'customers',
  'goods_receiving_items', 'goods_receiving_notes',
  'purchase_order_items', 'purchase_orders',
  'vendor_quotation_items', 'vendor_quotations',
  'demand_note_items', 'demand_notes', 'vendors',
  'items', 'categories', 'units',
  'attendance', 'leaves',
  'notifications', 'audit_logs',
  'user_roles', 'role_permissions',
  'users', 'employees', 'designations', 'departments', 'warehouses', 'branches',
  'companies',
];

async function main() {
  await prisma.$connect();
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
  console.log(`Wiped ${TABLES.length} tables.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
