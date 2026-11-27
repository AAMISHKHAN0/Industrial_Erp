# Industrial ERP 1.0.6 — Electron Data Flow, Stability, Token & `/unslop` Release Report

## 1. Deployed Windows Installer
| Property | Value |
| :--- | :--- |
| **Desktop Installer** | [Industrial ERP Setup 1.0.6.exe](file:///C:/Users/Aamishkhan/Desktop/Industrial%20ERP%20Setup%201.0.6.exe) |
| **Repo Build Artifact** | [Industrial ERP Setup 1.0.6.exe](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/dist/Industrial%20ERP%20Setup%201.0.6.exe) |
| **Unpacked App Binary** | [Industrial ERP.exe](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/dist/win-unpacked/Industrial%20ERP.exe) |
| **Installer Size** | `278,964,069` bytes (`266.04 MB`) |
| **SHA-256** | `372A9368B5C583808A3601C1B3A9159E9046A219E2DBAEED152036BC994F93E8` |

---

## 2. Root Causes Diagnosed & Fixed

### A. Installed-EXE "Invalid Token Error on Each Page" & Dashboard Metric Failures
1. **Stale `HttpOnly` Cookie Redirect Loop ([middleware.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/middleware.ts), [client.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/lib/api/client.ts), [auth.controller.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/backend/src/modules/auth/auth.controller.ts))**:
   - Backend sets `session_token` with `httpOnly: true`; client `document.cookie` calls could not clear it on expiry or DB reset, causing `middleware.ts` to 307-redirect `/login` back to `/dashboard` repeatedly.
   - `api.getWithMeta()` previously bypassed `handleResponse()` 401 recovery, surfacing raw `"Invalid or expired token"` error toasts on almost every page.
   - **Fix**: Unified all `api.*` methods (`get`, `getWithMeta`, `post`, `patch`, `delete`, `download`) through `handleUnauthorized()` (deduplicated redirect lock, clears local token, invokes `POST /auth/logout` with `credentials: 'include'`), updated `middleware.ts` to allow `/login?error=session_expired` without bouncing to `/dashboard` and clear `session_token`/`session` cookies, updated `POST /auth/logout` to clear cookies unconditionally, and disabled cloud Supabase fallback in `SupabaseAuthGuard` when `LOCAL_DESKTOP_MODE === 'true'`.
2. **Concurrent Dashboard Row Locks & Throttling ([session.service.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/backend/src/modules/auth/session.service.ts), [app.module.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/backend/src/app.module.ts), [dashboard/page.tsx](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/app/(dashboard)/dashboard/page.tsx), [topbar.tsx](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/components/layouts/topbar.tsx))**:
   - Throttled `lastActivity` updates in `SessionService.validateSession()` to at most once every 60s, raised `ThrottlerModule` limit from `100` to `1000` per 60s for local desktop use, updated `topbar.tsx` to check `err instanceof UnauthorizedError`, and guarded `dashboard/page.tsx` loading.
   - Added synchronous `window.desktopBridge.getApiBase()` in [preload.js](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/preload.js) cached in `client.ts`, dynamic `FRONTEND_URL` CORS in [main.js](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/main.js), and `LOCAL_DESKTOP_MODE`/`ATTACHMENTS_DIR` propagation.

### B. Electron Crashes, Freezes, Slowdowns & Upgrade Migration Sync
1. **GPU & Process Stability ([main.js](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/main.js))**:
   - Added `app.disableHardwareAcceleration()`, `uncaughtException`, `unhandledRejection`, `render-process-gone`, `child-process-gone`, `unresponsive`/`responsive`, and bounded auto-restart monitoring on `backendProcess`/`frontendProcess`.
   - Fixed Windows PID-reuse check in `cleanupStaleDesktopProcesses()` via `isOwnedPostgresProcessAlive(pid)`.
   - Stripped `ELECTRON_RUN_AS_NODE` via `buildChildEnv()` for spawned Node/backend/frontend children.
2. **Non-Blocking Backups & Migration Sync ([main.js](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/main.js), [backup.service.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/backend/src/modules/backup/backup.service.ts))**:
   - Deferred initial `checkDailyBackupSchedule()` by `60000ms` after startup, converted directory copies/SHA-256 hashing/archive listing to async `fs.promises` + streaming `crypto.createHash('sha256')`, and raised `pg_dump`/`tar.exe`/`psql.exe` timeouts to `300000ms`.
   - Disabled redundant 6h JSON DB auto-backup when `DISABLE_AUTO_DB_BACKUP === 'true'` in desktop mode.
   - Synced all Prisma migrations (including `20261125000000_fix_company_grn_voucher_columns`) and regenerated `@prisma/client` into `desktop/embedded/backend/`, updated `checkSchemaCompatibility()` across 9 critical columns, and bumped `migrationVersion` to `'1.0.6-rev2'`.

### C. Cross-Module Data Flows Fixed
- **Setup / Settings / Master Data**: Persisted `Company.city` and `Company.country` in Prisma + `CompanyService` + `/settings` + `/master-data/company` (refreshing `saveStoredCompany()`), implemented authenticated `POST /auth/change-password`, replaced raw ID inputs in `/master-data/employees` with Department/Designation/Gender dropdowns, and wired `/backups` to `window.desktopBridge.backup` `.tar.gz` archives.
- **Purchasing & Inventory**: Made `GoodsReceivingNote.poId` nullable (`Direct GRN`), added line-item editor in `/purchase/orders`, fixed `/inventory/material-issue` route (`POST /inventory/material-issue` instead of `/inventory/stock/issue`), per-line FIFO `unitCost`/`totalCost`, `demandNoteItemId` & `DemandNote.issuedQty` updates, `itemCode` field usage in transfers, and atomic `$transaction(tx)` propagation across Stock + FIFO + GL.
- **Production**: Fixed `QualityCheck` `createdBy` crash & default `checkDate`, added `Complete Order` UI + warehouse selection (`POST /production/orders/:id/complete`), resolved active company warehouse safely, and posted WIP/Inventory GL entries atomically.
- **Sales**: Added SO line-item editor and valid warehouse delivery picker in `/sales/orders`.
- **Finance, Payments, Expenses, Journal & Ledgers**: Added DB-backed `/finance/payments` (`/vendor`, `/utility`, `/fixed-asset`, `/statutory`) & `/finance/expenses`, removed fake `localStorage`/`00000000-*` fallbacks, isolated `[VENDOR_PAYMENT]`/`[UTILITY]`/`[FIXED_ASSET]` from Sundry Expenses, fixed `JournalEntryService.post()` to update `Account.balance` atomically by normal balance sign, fixed General Ledger double-counting/signs/date filters/CSV export, strictly scoped `getVendorTrail()` disbursements to target vendor, and populated Stock FIFO + Customer/Vendor names in `/finance/ledgers`.
- **HR**: Fixed optional/blank `clockIn`/`clockOut` on `/hr/attendance`, removed fake `localStorage` fallback in `/hr/wages`, and added `Process Payroll` trigger in `/hr/payroll`.
- **Dashboard & Reports**: Fixed `Array(12).fill({...})` shared-object bug, `SalesInvoice`-based monthly revenue & FIFO-based `inventoryValue` in `DashboardService`, fixed 404 route links (`/customers`, `/hr/wages`) in `dashboard/page.tsx`, and aligned `vendorCode`, `demandNumber`, `itemCode`, and month names in `/reports`.

### D. `/unslop` UI Polish
- Applied 9-pass `/unslop` refinement across `globals.css`, `sidebar.tsx`, `topbar.tsx`, `dashboard/page.tsx`, auth screens, and shared components: strict 4px spacing scale, neutral graphite surfaces + single cobalt `#2563eb` accent, aligned 16px Lucide icons (`strokeWidth={1.5}`), sentence-case copy, `tabular-nums` currency formatting, and calm non-pulsing transitions.
- Updated Electron splash screen (`desktop/splash.html`) to a bright enterprise palette and added Recharts performance graphs (`Revenue vs. Spend` and `Monthly Orders`) on `/dashboard`.
- Preserved authenticated desktop session across app close & reopen (avoiding redundant login/password prompts while enforcing session validation).

### E. Auto-Generated Codes, Nested Quick-Add Isolation & Full-Page Field Parity
- **Nested Quick-Add Auto-Save Fix ([quick-create-dialog.tsx](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/components/shared/quick-create-dialog.tsx))**: Eliminated React Portal synthetic `onSubmit` event bubbling across stacked modals by removing inner `<form>` elements inside `QuickCreateDialog`, switching the save action to a `type="button"` handler with `e.stopPropagation()` on `Enter` keydown and `DialogContent` `onSubmit`.
- **Full-Page Field Parity (`QuickCreateDialog`)**: Expanded all 19 Quick-Add entity forms (`vendor`, `customer`, `item`, `category`, `unit`, `warehouse`, `branch`, `department`, `designation`, `employee`, `account`, `bom`, `demandNote`, `quotation`, `purchaseOrder`, `productionOrder`, `salesOrder`, `payrollPeriod`, `payhead`) with every field from their dedicated pages plus a collapsible `More details (all optional fields)` section.
- **Auto-Generated Sequential Codes & Empty-State Prompts**: All modules auto-generate sequential document/master codes (`VND-`, `CUS-`, `ITM-`, `PO-`, `SO-`, `PRD-`, `DEM-`, `QUO-`, etc.), and empty `EntitySelect` dropdowns show contextual `"Add your <Entity>"` buttons that create inline and auto-select the newly created record.
- **Tasteful Brand & Website Attribution ([powered-by-footer.tsx](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/components/shared/powered-by-footer.tsx), [export-utils.ts](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/frontend/src/lib/reports/export-utils.ts))**: Added quiet enterprise `"Powered by Digitalerena · digitalerena.com"` footers across `AppShell` (every dashboard/module page), `/login`, `/setup`, `/forgot-password`, `desktop/splash.html`, `ReportDialog`, `Sales Invoice` & `Customer Receipt` modals, Excel/CSV exports, and every exported PDF (invoices, receipts, statements, wage slips, GRNs, demand notes, material issues, stock register, and report exports via `applyPdfBrandingFooter()`). Added external-link `setWindowOpenHandler` in [main.js](file:///d:/Textile-Erp-master%20(1)/Textile-Erp-master%20(1)/Textile-Erp-master/desktop/main.js) so clicking `digitalerena.com` opens in the user's browser cleanly.

---

## 3. Live Electron Verification (`--fresh-test`)
Tested against rebuilt `win-unpacked/Industrial ERP.exe --fresh-test` (`%APPDATA%\industrial-erp-fresh-test`):
- Cold fresh boot -> `/setup` -> `/dashboard`: **0** HTTP `404`/`401`/`429` errors; `desktopBridge.version === "1.0.6"`, `getApiBase()` resolved dynamically (`http://127.0.0.1:4001/api/v1`).
- End-to-end records verified in DB, UI, Ledgers, Dashboard KPIs (`monthlySales: 6900`, `inventoryValue: 1680`), and Reports: PO (`PO-2026-001`), PO & Direct GRN (`GRN-PO-01`, `GRN-DIRECT-03`), Material Issue FIFO (`MIN-2026-001`, `PKR 1,240.00`, closing stock `8 qty / PKR 960`), Production Order (`PRD-SMALL-01` completed), Quality Checks (`count=2`), Sales Order (`SO-2026-002` delivered), Mixed-Tax Invoice (`PKR 6,900`), Receipts (`Bank 2,000 + WHT 200 + Cheque 700` -> `4,000` open), Payments (`54,000` across all 4 heads), Expense (`1,500`), Journal (`3,000` updating `BANK` `500 -> 3,500`), Attendance, Daily Wages (`11,700`), Payroll (`isProcessed: true`), Settings password change, Logout & expired-token redirect (`0` loops/toast spam), and Warm-Boot Restart (`<8s`, all records intact).

## 4. Nested Quick-Add & Field Parity Verification (`1.0.6` Rebuild)
Verified against freshly rebuilt `win-unpacked/Industrial ERP.exe --fresh-test`:
- **3-Level Stacked Modals (`Add Purchase Order` -> `Add Inventory Item` -> `Add Category` / `Add Unit`)**: Saving innermost `Add Category` and `Add Unit` fired ONLY `/inventory/categories` and `/inventory/units` POSTs; both outer modals (`Add Inventory Item` and `Add Purchase Order`) stayed open and auto-selected the created Category/Unit.
- **2-Level Stacked Modals (`Add Purchase Order` -> `Add Inventory Item` & `Add Vendor`)**: Saving `Add Inventory Item` and `Add Vendor` left `Add Purchase Order` open (0 spurious `/purchase/orders` POSTs) until `Create` was clicked explicitly (`PO-0001`).
- **Full-Page Field Persistence**: Verified `40s Cotton Yarn` extended fields (`brand`, `hsnCode`, `minStock`, `maxStock`, `reorderLevel`, `purchasePrice`, `sellingPrice`, `description`) visible in `QuickCreateDialog` and persisted cleanly in PostgreSQL with **0** console or HTTP `>= 400` errors.
