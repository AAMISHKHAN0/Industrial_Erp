# Industrial ERP · Coding-agent task and acceptance evidence

## Copy this brief into the coding agent

> Upgrade the existing app in this repository under the product name Industrial ERP. Use the other five documents in this folder as the approved design input and identify all decisions still pending with the owner or accountant. Inspect the actual code and database first. Use the existing TypeScript/Next.js, NestJS, Prisma, PostgreSQL, UI components, permissions, inventory and accounting services where they match the required behavior. Build a supported Windows offline desktop distribution with Electron. Prioritize accurate posting, verified FIFO, secure local login, reliable backup and the owner’s daily workflows. Work with test fixtures or a sanitized copy of existing data. Apply additive, reviewed migrations and preserve posted accounting records. Implement each slice through API, UI, reports, printing and verification where applicable. Complete authorized unblocked work and keep dependency decisions explicit. Record actual test commands, results and any missing evidence. Treat the release checklist as incomplete until it passes on the intended Windows setup.

## 1. Establish the baseline

1. Check repository instructions and current git status. Record the branch, commit and package manager. Preserve work in progress. Identify package scripts and environments before running commands. Keep credentials and real financial information out of logs and fixtures.
2. Inspect `backend/prisma/schema.prisma`, committed migrations, stock and finance modules, `FinanceIntegrationService`, event wiring, auth guards and tenant middleware, accounts and journal handlers, sales flow, payroll, backups, and frontend route/security checks. Use the real paths where they differ from `README(1).md`.
3. Determine whether PO approval and SO confirmation post financial entries, whether delivery or invoice duplicates them, and which flows depend on in-memory events. Trace each posting to database rows. Inspect whether existing invoice, receipt, expense, payment and wage screens are usable through their normal entry points.
4. Run available static checks, builds and current tests using the repo scripts on an isolated DB. Snapshot existing amounts/quantity checks and capture screenshots for the key flows. Build a mapping of requirements and reference code with statuses **Verified**, **Incorrect**, **Missing**, or **Needs business decision**. Each verified item needs a code path, command or actual artifact.

## 2. Delivery slices

| Slice | Build | Exit evidence |
| --- | --- | --- |
| A. Offline proof and identity | Electron shell with packaged Next/Nest/Postgres startup, local owner setup, offline local sign-in, basic role validation, no external assets and a print sample. | Cold install in a clean Windows VM while disconnected. App launches, authenticates, prints or exports, restarts and preserves data. |
| B. Core transaction reliability | Balance checks, period locks, idempotent posting, audit, staged FIFO and ledger migration. Put approved stock flows through the shared service. | Exact numbers on FIFO and posting fixtures. Concurrency, rollback and duplicate-submit tests. Signed before/after valuation rehearsal on a representative snapshot. |
| C. Stores | GRN, demand-based issue, register and vendor receiving/billing/payments. Verify direct workflows with actual paperwork. | Trace posts from forms through API and source-linked stock/register/GL and printouts. Record partial receiving and matching results. |
| D. Sales and settlement | Sales invoice, invoice-time fields, dispatch handling, payments, withholding, allocation, and cheque lifecycle. | Client invoice/receipt samples render. AR aging and customer statement reconcile to the GL and prior receipts. |
| E. Statutory, expense and payroll | Tax/payment register, approved posting maps, utilities/petty cash, monthly salaries and daily wages, employee and tax statements, and fixed assets if confirmed. | Approved heads and accounting rules verified. Payroll details protected. From each payment evidence record trace to bank and journal, then to the source obligation. |
| F. Upgrade, restore and pilot | Release installation, data migration, reliable backup/restore, upgrade, recovery and permissions test. | Owner and accountant sign the workflow and reconciliation check on a pilot. Restore a verified backup on another VM. Track unresolved approvals separately from runtime defects. |

## 3. API and UI integration contract

Use the existing route naming and response envelope. Match analogous commands in the codebase before adding endpoints.

| Command | Input and response contract |
| --- | --- |
| Create or edit draft | Typed DTO, allowed fields only, authorized company/branch, optional revision to detect stale edits. Return the draft, stable reference and server-derived amounts. |
| Post/approve | Draft ID and revision, action-specific fields, stable idempotency key. Verify action and object permission, write atomically, return stored voucher number/status and source-linked effects. A repeat with the same payload returns the same committed result. |
| Record receipt/payment | Payment date, type, approved account, reference/evidence, decimal amounts and explicit allocations. Validate party, company, currency and open balances in the transaction. Return allocated, unapplied and outstanding amounts where applicable. |
| Reverse/correct | Posted source ID, reason, effective date and permission. Check dependencies and period. Return linked new voucher and effects. |
| Retrieve register or statement | Authorized scope/date range, party or item/head filter, stable sort and pagination. Return opening/closing and stable source IDs for drill-down. Use matching filters and scope for PDF/XLSX exports. |

Use decimal strings, stable date formats and client-friendly validation errors. Distinguish input validation, permission, stale revision, closed period, conflicting idempotency payload and a temporarily unavailable service. Persist idempotency across retries and restarts; when the response is lost, the UI should reuse the request identity or query the committed voucher before creating another. Avoid mutating posted state in the renderer. Keep draft data across recoverable validation errors. Generate printed vouchers from authorized posted snapshots.

## 4. Minimum test matrix

| ID | Test fixture | Expected evidence |
| --- | --- | --- |
| ST-01 | Receive 100 units × PKR 100, receive 50 × PKR 130, issue 120. | Issue cost PKR **12,600**, balance **30 units worth PKR 3,900**. Allocations show 100 and 20, the journal balances, and the inventory register ties to GL. |
| ST-02 | Two sessions each attempt to issue 20 from 30 available. In the successful session resubmit a committed action. | One issue commits, 10 remain, and only one stock/journal chain exists for the successful key. |
| ST-03 | Simulate failure between inventory and accounting writes. Repeat a GRN request and import a FIFO cutoff twice. | Failed posting leaves all related state at baseline. A retry commits once. The repeated cutoff import leaves the opening layers and GL unchanged. |
| ST-04 | Transfer an issue from two source layers. Perform a return and test ineligible backdating/posted reversal. | Destination preserves source costs and provenance according to policy. Exceptions follow the approved correction workflow. Inventory totals reconcile. |
| AP-01 | PO for 100, accept 60 at PKR 100, bill 40 at the same cost, pay PKR 3,000. Ignore tax for this fixture. | Accepted stock stays 60, GRNI remains PKR 2,000, vendor AP remains PKR 1,000, and bank is credited PKR 3,000. The PO approval itself caused no actual posting for this fixture. |
| AR-01 | Invoice PKR 100,000, receive PKR 94,000 cash and document PKR 3,000 eligible withholding. Reverse the receipt. | Outstanding PKR 3,000 before reversal and PKR 100,000 after reversal. Withholding account mirrors the approved effect and reversal. |
| AR-02 | Create dispatch and linked invoice. Record cheque, clear it and test return per signed policy using independent fixtures. | One stock deduction. Cheque states and ledger reflect selected settlement timing. Applicable return re-opens the invoice balance and preserves the voucher trail. |
| TAX-01 | Approved statutory payable PKR 20,000. Record payment PKR 12,000 with evidence; repeat identical submission. | Part-paid and outstanding PKR 8,000. One correct debit to the payable and one bank credit. Histories show obligation, supporting document, voucher and payment reference. Pending Labour cannot post. |
| HR-01 | Same salary period attempted twice. Wage rate PKR 2,000 × 5.5 approved days in a half-day fixture. | One salary accrual per intended employee/period/run. Wages PKR 11,000 and disbursement clears the employee payable without a duplicate wage expense. |
| FIN-01 | Close the accounting period concurrently with posting. View statements before and after reversals. | Exactly the ordered outcome allowed by the period policy. Opening plus signed activity equals closing, and customer/vendor/employee/tax totals reconcile to the applicable GL control accounts. |
| SEC-01 | First-run owner setup, duplicate setup attempt, disabled user, role change, owner recovery, and protected exports. | Only one bootstrap completes. Unauthorized actions are rejected by the server. Sessions are revoked per policy and existing books survive recovery. No bypass is present in the packaged client build. |
| DESK-01 | Fresh offline Windows install, restart, period entry, printer/PDF, backups, restore and a supported version upgrade. | Records persist, output prints correctly, attachments and totals match the backup cutoff on a separate machine, restored sessions are invalid, and failure recovery preserves data. |

The amounts are test fixtures. The accountant supplies expected actual posting rules, schedule data and samples for production UAT. Include pass/fail counts and evidence rather than relying on a build alone. Record the exact app commit, installer hash, migration versions, platform and test-data origin.

## Handoff checklist

- Source baseline and per-module scope verified, including old records and advanced workflows.
- Migrations reviewed, tested on representative data, and reconciled before and after cutover.
- Desktop release installed offline on the agreed Windows/office topology with verified roles and local recovery.
- Owner’s actual vouchers, statements, approval workflows and statutory evidence verified against agreed samples.
- High-impact defects corrected, and open commercial/accounting decisions called out by workflow. The owner and accountant review the evidence before live posting begins.
