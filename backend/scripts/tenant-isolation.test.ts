/**
 * Tenant isolation proof (run: npx ts-node scripts/tenant-isolation.test.ts)
 *
 * Proves the Prisma tenant extension safety net:
 *  TEST 1  A read with NO companyId filter is still scoped to the current tenant.
 *  TEST 2  A create with NO companyId is auto-assigned the current tenant.
 *  TEST 3  BOUNDARY: raw SQL ($queryRaw) is NOT scoped (documents the gap).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// --- load .env manually (no dependency assumptions) ---
try {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

import { TenantContext } from '../src/common/tenant/tenant-context';
import { PrismaService } from '../src/database/prisma.service';

const tenant = new TenantContext();
const prisma: any = new PrismaService(tenant);

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  \u2713 ${msg}`); }
  else { console.error(`  \u2717 FAIL: ${msg}`); failures++; }
}

async function main() {
  await prisma.$connect();
  const stamp = Date.now();

  // --- seed: two companies, each with one item (bypass enforcement) ---
  const { companyA, companyB } = await tenant.run({ companyId: null, bypass: true }, async () => {
    const companyA = await prisma.company.create({ data: { name: `ISO-A-${stamp}`, status: 'ACTIVE' } });
    const companyB = await prisma.company.create({ data: { name: `ISO-B-${stamp}`, status: 'ACTIVE' } });
    await prisma.item.create({ data: { companyId: companyA.id, itemCode: `A-${stamp}`, name: 'A Widget' } });
    await prisma.item.create({ data: { companyId: companyB.id, itemCode: `B-${stamp}`, name: 'B Widget' } });
    return { companyA, companyB };
  });
  console.log(`Seeded company A=${companyA.id} B=${companyB.id}\n`);

  // --- TEST 1: read with NO filter, in company A context ---
  console.log('TEST 1: findMany({}) with NO companyId filter, in company A context');
  await tenant.run({ companyId: companyA.id }, async () => {
    const items = await prisma.item.findMany({}); // deliberate developer mistake: no where
    const codes = items.map((i: any) => i.itemCode);
    assert(items.every((i: any) => i.companyId === companyA.id),
      `every returned item belongs to company A (got ${items.length} items)`);
    assert(!codes.includes(`B-${stamp}`), "company B's item is NOT returned");
    assert(codes.includes(`A-${stamp}`), "company A's item IS returned");
  });

  // --- TEST 2: create with NO companyId, in company A context ---
  console.log('\nTEST 2: create({data}) with NO companyId, in company A context');
  await tenant.run({ companyId: companyA.id }, async () => {
    const created = await prisma.item.create({ data: { itemCode: `C-${stamp}`, name: 'Auto-assigned' } });
    assert(created.companyId === companyA.id, `created item auto-assigned companyId = A (${created.companyId})`);
  });

  // --- TEST 3: BOUNDARY — raw SQL is NOT scoped ---
  console.log('\nTEST 3: BOUNDARY — $queryRaw is NOT scoped (documents the gap)');
  await tenant.run({ companyId: companyA.id }, async () => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "companyId" FROM items WHERE "itemCode" IN ($1,$2)`, `A-${stamp}`, `B-${stamp}`,
    );
    assert(rows.length === 2, `raw SQL returns BOTH companies' rows (got ${rows.length}) — confirms raw bypasses the extension`);
  });

  // --- cleanup ---
  await tenant.run({ companyId: null, bypass: true }, async () => {
    await prisma.item.deleteMany({ where: { itemCode: { in: [`A-${stamp}`, `B-${stamp}`, `C-${stamp}`] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  });

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
