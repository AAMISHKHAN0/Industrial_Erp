process.env.PORT = '3000';
process.env.HOSTNAME = '127.0.0.1';
process.chdir(require('path').resolve(__dirname, '../frontend/.next/standalone'));
require('../frontend/.next/standalone/server.js');
