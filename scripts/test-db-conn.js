const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/pg'));

const credPath = 'C:/Users/Aamishkhan/AppData/Roaming/Industrial ERP/data/.db_credentials.json';
const creds = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf8')) : {};

async function test() {
  for (const port of [5432, 5433]) {
    for (const [name, pwd] of [
      ['adminPassword', creds.adminPassword],
      ['appPassword', creds.appPassword],
      ['envPass', 'MBzfd9sgqg93dYfkkFVxrk$O4i37g%R3']
    ]) {
      if (!pwd) continue;
      try {
        const c = new Client({
          host: '127.0.0.1',
          port,
          user: name === 'appPassword' ? creds.appUser : 'postgres',
          password: pwd,
          database: 'postgres'
        });
        await c.connect();
        console.log(`Port ${port} connected with ${name}`);
        const dbs = await c.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        console.log(`  Databases: ${dbs.rows.map(r => r.datname).join(', ')}`);
        await c.end();
      } catch (e) {
        // failed
      }
    }
  }
}
test().catch(console.error);
