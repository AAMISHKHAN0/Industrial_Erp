# Fresh Setup & Create Account Screen Fix Report

## 1. Overview
When deleting application data or installing on a clean workspace, the app previously failed to present the **Create Account / First-Run Configuration** screen (`/setup`), defaulting to the login form (`/login`) or reviving an older database.

This issue has been thoroughly diagnosed and fixed across both the native Electron launcher and Next.js frontend routing. A brand new versioned installer has been built and deployed.

---

## 2. Root Cause Analysis

1. **Legacy Database Resurrection (`desktop/main.js`)**:
   - `resolveUserDataDir()` had a fallback check: if `%APPDATA%\Industrial ERP\data\pgsql_data\PG_VERSION` was deleted, but an older `%APPDATA%\industrial-erp-desktop` directory existed from legacy builds, it silently resolved to the legacy directory.
   - Consequently, deleting user data did not wipe the database; it resurrected the older database with existing users (`userCount > 0`), causing `/auth/bootstrap/status` to report `canBootstrap: false`.

2. **Hardcoded Port in Login View (`login/page.tsx`)**:
   - `login/page.tsx` read `NEXT_PUBLIC_API_URL` (inlined to `http://localhost:4000/api/v1` at build time). If the Electron app ran on dynamic port offsets, the client fetch failed, caught an error, and never toggled setup state.

3. **Unconditional Root Redirect (`frontend/src/app/page.tsx`)**:
   - The root page previously executed an unconditional server redirect: `redirect("/login")`, bypassing `/setup` completely.

4. **Stale Session Token Check Before Bootstrap Check**:
   - If a user wiped only the database directory (`data/`) but browser `localStorage` still preserved an old session token in Chromium, the root page checked for the session token before checking bootstrap status, routing to `/dashboard` (which returned 401 and redirected to `/login`).

5. **No Native Launcher Bootstrap Routing**:
   - Electron opened `http://127.0.0.1:${frontendPort}` unconditionally without checking if the database was fresh, relying entirely on client-side JS redirects.

---

## 3. Implementation Details

### A. Native Electron Launcher (`desktop/main.js`)
- **Direct User Data Path**: `resolveUserDataDir()` now returns `app.getPath('userData')` directly, preventing resurrection of any stale databases.
- **Native Startup Bootstrap Check**:
  Added `checkBootstrapRequired(activeBackendPort)`:
  ```javascript
  // Step 4: Setup native menu and open primary window
  createApplicationMenu();

  let initialPath = '';
  try {
    const needsBootstrap = await checkBootstrapRequired(activeBackendPort);
    if (needsBootstrap) {
      console.log('[Desktop] Fresh uninitialized database detected. Navigating directly to /setup.');
      initialPath = '/setup';
    }
  } catch (err) {
    console.log('[Desktop] Bootstrap pre-check notice:', err.message);
  }

  createMainWindow(activeFrontendPort, initialPath);
  ```
  When Electron detects `canBootstrap === true` on initial boot, it directly loads `http://127.0.0.1:${frontendPort}/setup`.

### B. Root Page Routing (`frontend/src/app/page.tsx`)
- Now inspects `/auth/bootstrap/status` **before** reading session tokens.
- If `status.initialized === false || status.canBootstrap === true`:
  - Purges any stale/orphaned session tokens (`clearAuthSessionToken()`).
  - Calls `router.replace("/setup")` immediately.

### C. Login Screen Auto-Redirect (`frontend/src/app/(auth)/login/page.tsx`)
- Uses dynamic `getApiBase()` to ensure queries always reach the correct port.
- When `status.canBootstrap === true`, purges any residual tokens and immediately redirects to `/setup`.

### D. Setup Page Robustness (`frontend/src/app/(auth)/setup/page.tsx`)
- Added connection retries during backend spin-up so slow database startup does not prematurely show "System Initialized".
- Properly provisions the Owner user and Company entity, establishes the session token, saves company profile to storage, and navigates to `/dashboard`.

---

## 5. Offline Password Recovery & Credential Autofill Protection

### Problem
1. **Unwanted Credential Autofill**: Chromium within Electron was silently saving and autofilling older email and password values into the login form inputs (`autoComplete="username"` and `autoComplete="current-password"`), causing authentication failures when databases were reset or reconfigured.
2. **Broken Cloud Password Reset**: The `/forgot-password` page was hardcoded to invoke external Supabase cloud email endpoints (`supabase.auth.resetPasswordForEmail`). In an offline, on-premise industrial desktop environment without internet or SMTP credentials, this caused password recovery to fail completely.

### Resolution
1. **Autofill Suppression**:
   - Added `autoComplete="off"` to the login `<form>` and email `<Input>`.
   - Added `autoComplete="new-password"` to the password `<Input>` to block Chromium from injecting obsolete saved credentials.
   - Added an immediate **"Clear credentials"** action link directly beside the "Remember email" switch so users can wipe any remembered account info in one click.
   - Ensured initial setup and database bootstrap dynamically update `remember-email` to the newly provisioned administrator account and purge old legacy values.
2. **Offline Local Password Reset**:
   - Added backend endpoint `GET /api/v1/auth/recovery-accounts`: Returns configured accounts on this computer so users do not have to guess their registered username/email.
   - Added backend endpoint `POST /api/v1/auth/reset-password`: Directly validates password strength (min 8 chars), re-hashes via Argon2id, revokes existing sessions, and updates the local PostgreSQL database immediately without external network or email dependencies.
   - Redesigned `frontend/src/app/(auth)/forgot-password/page.tsx` into an offline local recovery interface allowing users to select or enter their email, set their new password, and proceed straight to sign in.

---

## 6. Built & Verified Artifacts

| Property | Value |
| :--- | :--- |
| **Installer File** | `C:\Users\Aamishkhan\Desktop\Industrial ERP Setup 1.0.6.exe` |
| **File Size** | `281,256,673 bytes` (268.23 MB) |
| **SHA-256 Checksum** | `CADCFB84E8F9BAB823E7E2D1B29AD531D2B252DB2434125F171EAF55E0DC9951` |
| **Desktop Shortcut** | `Industrial ERP.lnk` |
