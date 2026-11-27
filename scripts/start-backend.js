process.env.PORT = '4000';
process.env.DATABASE_URL = 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public';
process.env.JWT_SECRET = 'textile-erp-jwt-secret-key-2026';
process.env.JWT_EXPIRATION = '3600';
process.env.JWT_REFRESH_EXPIRATION = '86400';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.DB_POOL_MAX = '30';

process.chdir(require('path').resolve(__dirname, '../backend'));
require('../backend/dist/src/main.js');
