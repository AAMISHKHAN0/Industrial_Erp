import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { BackupService } from '../src/modules/backup/backup.service';

describe('Disaster Recovery: Automated Backup, Restoration & Session Invalidation (DESK-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let backupService: BackupService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    backupService = app.get<BackupService>(BackupService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should take a snapshot backup, restore it, and verify sessions are revoked', async () => {
    // 1. Create a sentinel company record
    const compId = `backup_test_${Date.now()}`;
    await prisma.company.create({
      data: {
        id: compId,
        name: 'Disaster Recovery Corp',
        status: 'ACTIVE',
      },
    });

    // 2. Create an active user and session
    const user = await prisma.user.create({
      data: {
        email: `dr_user_${Date.now()}@digitalerena.local`,
        password: 'dummyhash_test',
        role: 'ADMIN',
        companyId: compId,
      },
    });

    const session = await prisma.session.create({
      data: {
        tokenHash: `token_hash_${Date.now()}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    expect(session.id).toBeDefined();

    // 3. Create full database backup
    const filename = await backupService.createBackup(true);
    expect(filename).toBeDefined();

    const backups = await backupService.listBackups();
    const currentBackup = backups.find((b) => b.filename === filename);
    expect(currentBackup).toBeDefined();

    // 4. Restore the backup
    await backupService.restoreBackup(currentBackup!.id);

    // 5. Verify the sentinel company is still present
    const compAfter = await prisma.company.findUnique({
      where: { id: compId },
    });
    expect(compAfter).toBeDefined();
    expect(compAfter?.name).toBe('Disaster Recovery Corp');

    // 6. Verify security requirement from Document 05:
    // "Revoke all restored sessions before allowing use of a recovered database."
    const activeSessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    expect(activeSessions.length).toBe(0);

    // Clean up
    await backupService.deleteBackup(currentBackup!.id);
    await prisma.user.deleteMany({ where: { companyId: compId } });
    await prisma.company.delete({ where: { id: compId } });
  });
});
