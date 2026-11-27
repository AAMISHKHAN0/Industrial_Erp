const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function runMigrations(dbUrl) {
  console.log('[Migration Runner] Checking target database readiness...');
  const targetUrl = dbUrl || process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/textile_erp?schema=public';
  
  // Parse target connection parameters
  const parsed = new URL(targetUrl);
  const targetDbName = parsed.pathname.replace(/^\//, '') || 'textile_erp';
  const targetHost = parsed.hostname || '127.0.0.1';
  const targetPort = parsed.port || 5432;
  const targetUser = decodeURIComponent(parsed.username || 'postgres');
  const targetPassword = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  // 1. Connect to root 'postgres' database to ensure target database exists
  const rootClient = new Client({
    host: targetHost,
    port: targetPort,
    user: targetUser,
    password: targetPassword,
    database: 'postgres',
  });

  const appRole = process.env.APP_DB_USER || 'erp_app';
  const appPassword = process.env.APP_DB_PASSWORD;

  try {
    await rootClient.connect();
    const dbCheck = await rootClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDbName]);
    if (dbCheck.rows.length === 0) {
      console.log(`[Migration Runner] Database "${targetDbName}" does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`[Migration Runner] Database "${targetDbName}" created successfully.`);
    } else {
      console.log(`[Migration Runner] Database "${targetDbName}" exists.`);
    }

    if (appPassword) {
      const roleCheck = await rootClient.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRole]);
      if (roleCheck.rows.length === 0) {
        console.log(`[Migration Runner] Creating least-privilege role "${appRole}"...`);
        await rootClient.query(`CREATE ROLE "${appRole}" WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
        console.log(`[Migration Runner] Role "${appRole}" created successfully.`);
      } else {
        await rootClient.query(`ALTER ROLE "${appRole}" WITH LOGIN PASSWORD '${appPassword.replace(/'/g, "''")}'`);
        console.log(`[Migration Runner] Role "${appRole}" password updated.`);
      }
    }
  } catch (err) {
    console.error('[Migration Runner] Error connecting to postgres root DB:', err.message);
    throw err;
  } finally {
    await rootClient.end().catch(() => {});
  }

  // 2. Connect to the target database
  const client = new Client({
    host: targetHost,
    port: targetPort,
    user: targetUser,
    password: targetPassword,
    database: targetDbName,
  });

  await client.connect();

  try {
    // 3. Ensure _prisma_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id VARCHAR(36) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMPTZ,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 4. Read migrations directory
    const migrationsDir = path.join(__dirname, 'prisma/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migration Runner] No migrations directory found. Skipping.');
      return;
    }

    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    console.log(`[Migration Runner] Found ${entries.length} migrations in directory.`);

    for (const migrationName of entries) {
      const sqlFile = path.join(migrationsDir, migrationName, 'migration.sql');
      if (!fs.existsSync(sqlFile)) continue;

      // Check if migration was already applied
      const res = await client.query(
        'SELECT id, finished_at FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL',
        [migrationName]
      );

      if (res.rows.length > 0) {
        console.log(`  ✓ Migration "${migrationName}" already applied.`);
        continue;
      }

      console.log(`  → Applying migration "${migrationName}"...`);
      const sqlContent = fs.readFileSync(sqlFile, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
      const migId = crypto.randomUUID();

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
           VALUES ($1, $2, now(), $3, 1)`,
          [migId, checksum, migrationName]
        );
        await client.query('COMMIT');
        console.log(`  ✓ Successfully applied "${migrationName}".`);
      } catch (applyErr) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed applying migration "${migrationName}":`, applyErr.message);
        throw applyErr;
      }
    }

    console.log('[Migration Runner] All migrations are up to date.');

    // 5. If an app runtime role exists (e.g., erp_app), ensure least-privilege permissions are granted
    const appRole = process.env.APP_DB_USER || 'erp_app';
    const roleCheck = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRole]);
    if (roleCheck.rows.length > 0) {
      console.log(`[Migration Runner] Synchronizing least-privilege grants for "${appRole}"...`);
      await client.query(`GRANT CONNECT ON DATABASE "${targetDbName}" TO "${appRole}"`);
      await client.query(`GRANT USAGE ON SCHEMA public TO "${appRole}"`);
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}"`);
      await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${appRole}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${targetUser}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${appRole}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${targetUser}" IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${appRole}"`);
      console.log(`[Migration Runner] Least-privilege permissions synchronized for "${appRole}".`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Migration Runner] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
