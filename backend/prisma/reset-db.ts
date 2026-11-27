/**
 * Reset the database to a clean state.
 * - Truncates ALL tables (CASCADE)
 * - Seeds a fresh default company
 * - Seeds default roles (OWNER, ADMIN, MANAGER, STAFF, MEMBER)
 *
 * Usage:  npx ts-node prisma/reset-db.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('⚠️  This will DELETE ALL DATA from the database!\n');

  // Disable all foreign key checks and truncate everything
  const tables = [
    'pay_slip_items',
    'pay_slips',
    'payroll_periods',
    'payheads',
    'leaves',
    'attendance',
    'material_consumptions',
    'quality_checks',
    'production_orders',
    'bom_materials',
    'bill_of_materials',
    'sales_order_items',
    'sales_orders',
    'customers',
    'goods_receiving_items',
    'goods_receiving_notes',
    'purchase_order_items',
    'purchase_orders',
    'vendor_quotation_items',
    'vendor_quotations',
    'vendor_items',
    'demand_note_items',
    'demand_notes',
    'vendors',
    'items',
    'units',
    'categories',
    'warehouse_stock',
    'stock_ledger',
    'warehouses',
    'journal_entry_items',
    'journal_entries',
    'accounts',
    'notifications',
    'audit_logs',
    'user_roles',
    'role_permissions',
    'roles',
    'permissions',
    'employees',
    'designations',
    'departments',
    'branches',
    'sessions',
    'users',
    'companies',
    'backups',
  ];

  console.log('🗑️  Truncating all tables...');

  // Disable triggers and truncate all tables
  await prisma.$executeRawUnsafe('SET session_replication_role = REPLICA;');
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    console.log(`   ✓ ${table}`);
  }
  await prisma.$executeRawUnsafe('SET session_replication_role = ORIGIN;');

  console.log('\n✅ All data deleted.\n');

  // ─── Seed fresh data ───────────────────────────────────────────────

  console.log('🌱 Seeding fresh data...');

  // 1. Create default company
  const company = await prisma.company.create({
    data: {
      name: 'Textile ERP',
      email: 'admin@textileerp.com',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Company: ${company.name} (${company.id})`);

  // 2. Create default roles
  const rolesData = [
    { name: 'OWNER', description: 'Full system owner', isSystem: true },
    { name: 'ADMIN', description: 'System administrator', isSystem: true },
    { name: 'MANAGER', description: 'Department manager', isSystem: true },
    { name: 'STAFF', description: 'Regular staff member', isSystem: true },
    { name: 'MEMBER', description: 'Basic member', isSystem: true },
  ];

  const roleMap: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.create({ data: r });
    roleMap[r.name] = role.id;
    console.log(`   ✓ Role: ${r.name}`);
  }

  // 3. Create default permissions
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
      const perm = await prisma.permission.create({
        data: { name, code, module: mod, description: `${action} ${mod}` },
      });
      permMap[name] = perm.id;
    }
  }
  console.log(`   ✓ ${Object.keys(permMap).length} permissions created`);

  // 4. Assign all permissions to OWNER role
  const allPermIds = Object.values(permMap);
  for (const permId of allPermIds) {
    await prisma.rolePermission.create({
      data: { roleId: roleMap['OWNER'], permissionId: permId },
    });
  }
  console.log('   ✓ All permissions assigned to OWNER');

  // Assign subset to other roles
  const adminPerms = allPermIds.filter((id) => {
    const permName = Object.entries(permMap).find(([, v]) => v === id)?.[0] || '';
    return !permName.startsWith('backups:') && !permName.startsWith('roles:');
  });
  for (const permId of adminPerms) {
    await prisma.rolePermission.create({
      data: { roleId: roleMap['ADMIN'], permissionId: permId },
    });
  }
  console.log('   ✓ Permissions assigned to ADMIN');

  const managerPermNames = modules
    .filter((m) => !['users', 'roles', 'backups', 'settings'].includes(m))
    .flatMap((m) => actions.filter((a) => a !== 'delete').map((a) => `${m}:${a}`));
  for (const permName of managerPermNames) {
    if (permMap[permName]) {
      await prisma.rolePermission.create({
        data: { roleId: roleMap['MANAGER'], permissionId: permMap[permName] },
      });
    }
  }
  console.log('   ✓ Permissions assigned to MANAGER');

  const staffPermNames = modules
    .filter((m) => !['users', 'roles', 'backups', 'settings'].includes(m))
    .flatMap((m) => ['read'].map((a) => `${m}:${a}`));
  for (const permName of staffPermNames) {
    if (permMap[permName]) {
      await prisma.rolePermission.create({
        data: { roleId: roleMap['STAFF'], permissionId: permMap[permName] },
      });
    }
  }
  console.log('   ✓ Read permissions assigned to STAFF');

  // 5. Create a "General" department
  await prisma.department.create({
    data: { companyId: company.id, name: 'General', status: 'ACTIVE' },
  });
  console.log('   ✓ Department: General');

  // 6. Seed default finance accounts
  const defaultAccounts = [
    { accountCode: 'INVENTORY', name: 'Inventory', type: 'ASSET' as const },
    { accountCode: 'ACCOUNTS_PAYABLE', name: 'Accounts Payable', type: 'LIABILITY' as const },
    { accountCode: 'ACCOUNTS_RECEIVABLE', name: 'Accounts Receivable', type: 'ASSET' as const },
    { accountCode: 'SALES_REVENUE', name: 'Sales Revenue', type: 'INCOME' as const },
    { accountCode: 'SALARY_EXPENSE', name: 'Salary Expense', type: 'EXPENSE' as const },
    { accountCode: 'SALARY_PAYABLE', name: 'Salary Payable', type: 'LIABILITY' as const },
    { accountCode: 'CASH', name: 'Cash', type: 'ASSET' as const },
    { accountCode: 'BANK', name: 'Bank', type: 'ASSET' as const },
  ];
  for (const acc of defaultAccounts) {
    await prisma.account.create({
      data: { ...acc, companyId: company.id, isActive: true, balance: 0 },
    });
  }
  console.log('   ✓ 8 default finance accounts');

  console.log('\n🎉 Database reset complete!');
  console.log(`\n   Company ID: ${company.id}`);
  console.log('   Register a new owner via the app to get started.\n');
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
