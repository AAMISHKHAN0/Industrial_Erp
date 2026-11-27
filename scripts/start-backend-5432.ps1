# start-backend-5432.ps1
$env:PORT = "4000"
$env:DATABASE_URL = "postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public"
$env:JWT_SECRET = "textile-erp-jwt-secret-key-2026"
$env:JWT_EXPIRATION = "3600"
$env:JWT_REFRESH_EXPIRATION = "86400"
$env:FRONTEND_URL = "http://localhost:3000"

Set-Location "backend"
node dist/src/main.js
