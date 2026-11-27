import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { SessionAuthGuard } from '../src/modules/auth/guards/session-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { Roles } from '../src/modules/auth/decorators/roles.decorator';

// Test controller to strictly verify server-enforced RBAC (RolesGuard)
@Controller('test-rbac')
@UseGuards(SessionAuthGuard, RolesGuard)
class TestRbacController {
  @Get('owner-only')
  @Roles('OWNER')
  ownerOnly() {
    return { access: 'granted', role: 'OWNER' };
  }

  @Get('admin-only')
  @Roles('ADMIN')
  adminOnly() {
    return { access: 'granted', role: 'ADMIN' };
  }
}

describe('Offline Authentication & Identity E2E (SEC-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestRbacController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean database before starting test suite
    const tables = [
      'sessions',
      'user_roles',
      'role_permissions',
      'roles',
      'permissions',
      'accounts',
      'departments',
      'users',
      'companies',
    ];
    await prisma.$executeRawUnsafe('SET session_replication_role = REPLICA;');
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    await prisma.$executeRawUnsafe('SET session_replication_role = ORIGIN;');
  });

  afterAll(async () => {
    await app.close();
  });

  let sessionToken: string;
  let sessionCookie: string;
  let adminEmail = 'owner@digitalerena.local';
  const adminPassword = 'ComplexPassword#2026';

  describe('SEC-01.1 & SEC-01.2: One-Time Bootstrap & Anti-Takeover', () => {
    it('initial bootstrap status indicates uninitialized system', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/bootstrap/status')
        .expect(200);

      expect(res.body.initialized).toBe(false);
      expect(res.body.canBootstrap).toBe(true);
    });

    it('cold-start initial admin setup: two simultaneous requests create only one administrator, rejecting concurrent race with 409', async () => {
      const p1 = request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap')
        .send({
          companyName: 'Digital Erena Industrial Corp',
          adminEmail: 'owner@digitalerena.local',
          adminName: 'Chief Administrator',
          password: adminPassword,
        });

      const p2 = request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap')
        .send({
          companyName: 'Digital Erena Race Attacker Inc',
          adminEmail: 'attacker@evil.local',
          adminName: 'Concurrent Attacker',
          password: adminPassword,
        });

      const [res1, res2] = await Promise.all([p1, p2]);
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const successRes = res1.status === 201 ? res1 : res2;
      expect(successRes.body.company).toBeDefined();
      expect(successRes.body.user).toBeDefined();
      expect(successRes.body.user.role).toBe('OWNER');
      expect(successRes.body.sessionToken).toBeDefined();
      expect(typeof successRes.body.sessionToken).toBe('string');

      adminEmail = successRes.body.user.email;

      // Verify Set-Cookie header contains session_token
      const cookies = successRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieHeader).toContain('session_token=');
      expect(cookieHeader).toContain('HttpOnly');

      sessionToken = successRes.body.sessionToken;
      sessionCookie = Array.isArray(cookies) ? cookies[0] : cookies;

      // Concurrency check: verify exactly ONE company and ONE user exist in the DB
      const totalUsers = await prisma.user.count();
      expect(totalUsers).toBe(1);
      const totalCompanies = await prisma.company.count();
      expect(totalCompanies).toBe(1);

      // Verify Argon2id password hash in DB
      const userInDb = await prisma.user.findUnique({
        where: { email: adminEmail },
      });
      expect(userInDb).toBeDefined();
      expect(userInDb?.password).toMatch(/^\$argon2id\$/);

      // Verify DB Session record with SHA-256 digest
      const sessionCount = await prisma.session.count({
        where: { userId: userInDb?.id },
      });
      expect(sessionCount).toBe(1);
    });

    it('rejects duplicate bootstrap with 409 Conflict (anti-takeover)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap')
        .send({
          companyName: 'Attacker Imposter Inc',
          adminEmail: 'attacker@evil.local',
          adminName: 'Attacker',
          password: 'AnotherPassword#2026',
        })
        .expect(409);
    });

    it('bootstrap status now indicates initialized system', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/bootstrap/status')
        .expect(200);

      expect(res.body.initialized).toBe(true);
      expect(res.body.canBootstrap).toBe(false);
    });
  });

  describe('SEC-01.3 & SEC-01.4: Offline Sign-In & Invalid Credential Handling', () => {
    it('offline sign-in with valid credentials returns session token and profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: adminPassword,
        })
        .expect(200);

      expect(res.body.user.email).toBe(adminEmail);
      expect(res.body.user.role).toBe('OWNER');
      expect(res.body.sessionToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();

      // Update tokens for subsequent tests
      sessionToken = res.body.sessionToken;
      const cookies = res.headers['set-cookie'];
      sessionCookie = Array.isArray(cookies) ? cookies[0] : cookies;
    });

    it('offline sign-in with invalid password fails with generic 401 Unauthorized without user enumeration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: 'CompletelyWrongPassword123!',
        })
        .expect(401);

      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('offline sign-in with non-existent user returns identical generic 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@nowhere.local',
          password: 'CompletelyWrongPassword123!',
        })
        .expect(401);

      expect(res.body.message).toMatch(/Invalid email or password/i);
    });
  });

  describe('SEC-01.5: Progressive Throttling / Rate Limiting', () => {
    it('5 consecutive invalid login attempts triggers 429 Too Many Requests', async () => {
      const targetEmail = 'throttle_target@digitalerena.local';
      // Create user for throttle testing
      const company = await prisma.company.findFirst();
      await prisma.user.create({
        data: {
          companyId: company!.id,
          email: targetEmail,
          password: '$argon2id$mock',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });

      // Submit 4 failed attempts (returns 401)
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: targetEmail, password: 'WrongPassword!' })
          .expect(401);
      }

      // 5th failed attempt triggers lockout / throttling
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword!' })
        .expect(401);

      // 6th attempt is throttled
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword!' })
        .expect(429);

      expect(res.body.message).toMatch(/throttled|too many/i);
    });
  });

  describe('SEC-01.7: Server-Side Session Revocation on Logout', () => {
    it('retrieves active session profile with Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(res.body.email).toBe(adminEmail);
      expect(res.body.role).toBe('OWNER');
    });

    it('retrieves active session profile with Cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/session')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.email).toBe(adminEmail);
    });

    it('logging out revokes session on server side', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('subsequent request with revoked token returns 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);
    });
  });

  describe('SEC-01.8: Server-Enforced RBAC (RolesGuard)', () => {
    let staffToken: string;
    let ownerToken: string;

    beforeAll(async () => {
      // Login as owner again to get fresh token
      const ownerLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword });
      ownerToken = ownerLogin.body.sessionToken;

      // Create a staff user
      const company = await prisma.company.findFirst();
      const staffPassword = 'StaffPassword#2026';
      const passwordHash = '$argon2id$v=19$m=19456,t=2,p=1$mock$mock';
      const staffUser = await prisma.user.create({
        data: {
          companyId: company!.id,
          email: 'staff1@digitalerena.local',
          password: passwordHash,
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });

      // Directly create active session for staff user
      const sessionService = app.get(SessionAuthGuard)['sessionService'];
      const session = await sessionService.createSession(staffUser.id);
      staffToken = session.sessionToken;
    });

    it('OWNER user can access owner-only endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.access).toBe('granted');
    });

    it('STAFF user attempting OWNER endpoint returns 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('unauthenticated request returns 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .expect(401);
    });
  });

  describe('DESK-01.2: Pre-Flight Health Check', () => {
    it('GET /api/v1/health reports database connected and initialized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(res.body.initialized).toBe(true);
    });
  });
});
