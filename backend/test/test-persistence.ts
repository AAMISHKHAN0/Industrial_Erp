import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@localhost:5432/textile_erp_test?schema=public';

async function verifyPersistence() {
  console.log('=== Step 1: Testing PostgreSQL Persistence Across Restarts ===');

  // Client session 1: Insert test persistence record
  const adapter1 = new PrismaPg({ connectionString });
  const prisma1 = new PrismaClient({ adapter: adapter1 });
  await prisma1.$connect();

  const testId = `persist_${Date.now()}`;
  console.log(`Creating test company record with id: ${testId}...`);

  const created = await prisma1.company.create({
    data: {
      id: testId,
      name: 'Persistence Verification Co',
      email: 'verify@digitalerena.local',
      status: 'ACTIVE',
    },
  });
  console.log('Record created in Client Session 1:', created.id, created.name);

  // Hard disconnect Client 1 (simulating process termination / application restart)
  await prisma1.$disconnect();
  console.log('Client Session 1 disconnected (simulating shutdown).');

  // Client session 2: Reconnect in fresh process context and query record
  const adapter2 = new PrismaPg({ connectionString });
  const prisma2 = new PrismaClient({ adapter: adapter2 });
  await prisma2.$connect();
  console.log('Client Session 2 connected (simulating restart).');

  const fetched = await prisma2.company.findUnique({
    where: { id: testId },
  });

  if (!fetched || fetched.name !== 'Persistence Verification Co') {
    throw new Error(
      `Persistence verification FAILED: record ${testId} not found in database!`,
    );
  }
  console.log(
    '✓ Persistence SUCCESS: record retrieved identically after reconnection:',
    fetched.id,
    fetched.name,
  );

  // Clean up test record
  await prisma2.company.delete({ where: { id: testId } });
  await prisma2.$disconnect();
  console.log('✓ Test cleanup complete.');
}

verifyPersistence().catch((err) => {
  console.error('Persistence failed:', err);
  process.exit(1);
});
