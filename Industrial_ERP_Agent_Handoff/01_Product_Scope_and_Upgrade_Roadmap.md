# Industrial ERP · Product scope and upgrade roadmap

DigitalErena engineering handoff · 20 November 2026

## Product decision

Use **Industrial ERP** as the working display name. The first client is an industrial business with Stores, Sales, Accounts, and Payroll workflows. Reuse the existing application under that product identity. Use generic terms for company, warehouse, item, unit, department and job or production order. Preserve existing industry-specific records and advanced features. Surface them when a company uses them. Limit the rename to product-facing labels and new deployment metadata where safe. Inspect existing installer identifiers and data paths before changing them because they can affect upgrades.

**Evidence level.** The owner’s paper and zoomed photo establish the requested workflows. The earlier chat establishes a FIFO design direction. The README describes the existing codebase and its behavior. The actual repository, database and Windows installer were unavailable. The classifications below are backlog decisions and verification targets. The agent must update them against source and runtime evidence.

## What to add, improve and upgrade

| Work area | Reuse | Add or improve | Release decision |
| --- | --- | --- | --- |
| **Stores** | Item/unit/vendor/warehouse masters, GRN, stock issue, transfer and movement history from the README | Direct GRN and demand-linked material issue screen. Opening/in/out/closing register with quantities and values. FIFO layers and allocations in the central stock service. | Day-one. Preserve purchase-order receiving and validate a separate direct GRN if the client needs it. |
| **Sales and collections** | Customers, sales orders, reservations, dispatch and GL | Verify or add numbered multi-line Sales Invoice, print/PDF, then customer receipt with invoice allocations, withholding, cheque status and customer statement. | Day-one. Test both order-linked and direct invoicing if the client uses both. |
| **Supplier and outward payments** | Vendor master, PO/GRN, chart of accounts, finance integration | Verify or add supplier bills, bill allocations, cash/bank/cheque payment, approval/reversal, vendor statement and outstanding balance. | Day-one. Confirm GRN/bill and supplier payment paperwork with Accounts. |
| **Tax and statutory** | Existing account types and payment infrastructure if available | One register with separate heads for Sales Tax, Income Tax, Customs Duty, Professional Tax, PESSI and the pending Labour label. Record obligation, approval, payment and evidence separately. | Day-one for approved heads. Enable Labour once the owner identifies the payment. |
| **Expenses and utilities** | Accounts and common voucher components | Daily sundry expense form with payee, date, conveyance, fuel, miscellaneous and applicable tax/NTN. Add electricity, water and rent as expense/payable workflows. | Day-one. Decide whether a bill is accrued or directly paid based on the actual workflow. |
| **Payroll** | Employee, payroll period, pay heads, attendance and payslip | Make monthly salaries fast to review. Add daily wages with rate snapshots, days, period, disbursement and employee statement. Confirm half-day, overtime, attendance import and overlap rules before enabling. | Day-one. Payroll calculations and employee visibility must be tested with client samples. |
| **Fixed assets** | Vendor, purchase bill and GL | Candidate: acquisition linked to bill or payment and a searchable asset register. | Confirm the mostly blank owner box. Confirm depreciation, disposal and registers separately. |
| **Statements and reporting** | Stock ledger, journal, trial balance, P&L and balance sheet documented in the README | Vendor, customer, stock, employee and tax statements with opening, activity, running and closing balance, voucher drill-down and export. Add exception lists for unpaid invoices, unbilled GRNs, uncleared cheques and statutory items due. | Day-one. Statements should tie back to controlling balances. |
| **Desktop and security** | Next.js/React, NestJS, Prisma, PostgreSQL and existing components | Electron installer, offline accounts, session controls, permission checks, audit history, reliable backups and tested restoration. | Release gate. Confirm Windows versions and single-PC versus multi-PC usage. |
| **Production and advanced modules** | Existing BOM, production orders, QC, departments and warehouses | Apply the same stock and posting services. Test current workflows for regressions. Expose advanced features through role permissions. | Preserve current behavior where it matches approved posting policy. Defer new production features until the owner specifies them. |

## Owner’s form fields

| Paper section | Fields to carry into review |
| --- | --- |
| Material inward | GRN, vendor and unclear short reference labels. Ask the owner to expand the acronyms from an actual voucher. |
| Material issue | Demand reference, item, quantity and receiving department/job as appropriate. Verify whether the existing procurement Demand Note serves the same purpose. |
| Sales invoice | Customer, PO, NTN, STN/STRN, description, taxable value, sales tax and total. Validate numbering, due date, line units, approved print layout and applicable legal fields with Accounts. |
| Receipt | Customer, PO reference, amount, tax deducted, and cheque. Link the receipt to invoice allocations where the client’s books require it. |
| Salaries and wages | Monthly period for salaries. Employee name, rate and days for wages. Add paid versus outstanding status from payment records. |
| Sundry and stock register | Payee, dates, conveyance, fuel, daily/misc, total and applicable tax/NTN. For stock use opening quantity, in, out and closing quantity, plus values. |

## Everyday experience

Use a role-based workspace with Stores, Sales & Receipts, Accounts & Payments, Payroll, and Reports. On list pages, show task state and what needs action. On forms, prioritize searchable selectors, keyboard-first entry, multi-row editing, sensible defaults, and a clear difference between **Save Draft**, **Post**, and **Reverse**. Use desktop-sized tables and A4 templates from the client’s actual paperwork. Employees need a clear print/reprint action, with stored historical invoice details and document version references. Use PKR and a defined local business-date convention, initially `Asia/Karachi` for this client.

Advanced modules remain available to permitted roles. Defer incremental items such as multi-site synchronization, biometric integration, new production planning, automatic tax calculation, and external filing until the owner confirms the need and the applicable operating rules.

## Decisions to get from the owner and accountant

1. **Seats and deployment.** One PC or concurrent users from separate PCs? Which Windows versions, printers and backup media are available? Confirm who can post, reverse and restore.
2. **Documents.** Collect a sample GRN, demand/issue slip, sales invoice, receipt, petty cash voucher, payroll/wage sheet, stock register, supplier bill and each statutory challan. Confirm unclear GRN labels and whether a PO is mandatory.
3. **Accounting.** Which event recognizes inventory, AP, AR, revenue, cost and withholding? Who approves GRNs, goods returns, adjustments, credit notes, cheque reversals, and period reopenings? Agree on a signed reconciliation fixture.
4. **Tax.** Confirm applicable registrations, jurisdictions, portal requirements and permitted contingency procedure. Ask what “Labour” specifically refers to and request its actual notice/challan. See [04_Statutory_Payments_Pakistan.md](04_Statutory_Payments_Pakistan.md).
5. **Migration.** Confirm legacy data and its accuracy, the FIFO cutoff and opening value, acceptable data loss in a disaster, and time to restore service.

## How the agent should use this pack

1. Start with [06_Agent_Implementation_and_Acceptance.md](06_Agent_Implementation_and_Acceptance.md) and establish the repo baseline.
2. Use [02_Workflows_and_Accounting.md](02_Workflows_and_Accounting.md) to trace posting, then [03_Database_and_Migrations.md](03_Database_and_Migrations.md) to design additive database changes.
3. Implement the statutory and desktop tracks from [04_Statutory_Payments_Pakistan.md](04_Statutory_Payments_Pakistan.md) and [05_Offline_Desktop_and_Secure_Login.md](05_Offline_Desktop_and_Secure_Login.md).

The scope comes from the owner’s photos, the supplied chat transcript and `README(1).md`. Treat crop text as source evidence for labels and the README as a guide to locate implementation. Keep the owner’s current records and production behavior in view throughout the upgrade.
