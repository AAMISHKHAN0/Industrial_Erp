# Textile ERP — Enterprise Resource Planning for Textile Manufacturing

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20(App%20Router)-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/UI-React%2019-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%207-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis%207-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Auth-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

A full-scale, production-ready **Textile Manufacturing Enterprise Resource Planning (ERP)** system built with modern enterprise architectural standards. Designed specifically for vertical textile manufacturing operations (yarn sourcing, fabric weaving/knitting, dyeing/finishing, garment production, warehousing, and wholesale sales), the platform completely integrates procurement, shop-floor production, stock management, sales orders, double-entry financial accounting, and human resource payroll into a single unified reactive web application.

---

## Table of Contents

1. [Executive Overview & Core Value](#1-executive-overview--core-value)
2. [Technology Stack](#2-technology-stack)
   - [Frontend Architecture](#frontend-architecture)
   - [Backend Architecture](#backend-architecture)
   - [Database, Storage & Caching](#database-storage--caching)
   - [Authentication, Security & Multi-Tenancy](#authentication-security--multi-tenancy)
3. [System Architecture & Design Patterns](#3-system-architecture--design-patterns)
   - [Tenant Isolation & Prisma Client Extension](#tenant-isolation--prisma-client-extension)
   - [In-Memory Event Bus & Domain Events](#in-memory-event-bus--domain-events)
   - [Automated General Ledger Integration](#automated-general-ledger-integration)
4. [End-to-End Business Workflows](#4-end-to-end-business-workflows)
   - [Procure-to-Pay (P2P) Flow](#procure-to-pay-p2p-flow)
   - [Manufacturing & Bill of Materials (BOM) Flow](#manufacturing--bill-of-materials-bom-flow)
   - [Order-to-Cash (O2C) Sales Flow](#order-to-cash-o2c-sales-flow)
   - [HR Attendance, Leaves & Payroll Lifecycle](#hr-attendance-leaves--payroll-lifecycle)
5. [Comprehensive Module Walkthrough](#5-comprehensive-module-walkthrough)
   - [1. Master Data Management](#1-master-data-management)
   - [2. Inventory & Multi-Warehouse Management](#2-inventory--multi-warehouse-management)
   - [3. Procurement & Purchase Management](#3-procurement--purchase-management)
   - [4. Production & Manufacturing Management](#4-production--manufacturing-management)
   - [5. Sales & Customer Order Management](#5-sales--customer-order-management)
   - [6. Finance, Accounting & General Ledger](#6-finance-accounting--general-ledger)
   - [7. Human Resources & Payroll](#7-human-resources--payroll)
   - [8. Analytics, Dashboards & Reporting Suite](#8-analytics-dashboards--reporting-suite)
   - [9. Role Management & Access Control (RBAC)](#9-role-management--access-control-rbac)
   - [10. Audit Logging, Activity Tracking & Backups](#10-audit-logging-activity-tracking--backups)
6. [API Reference & REST Endpoints Catalog](#6-api-reference--rest-endpoints-catalog)
7. [Database Schema & Entity Relationship Overview](#7-database-schema--entity-relationship-overview)
8. [Repository Directory Structure](#8-repository-directory-structure)
9. [Prerequisites & Environment Configuration](#9-prerequisites--environment-configuration)
   - [Backend Environment Variables (`backend/.env`)](#backend-environment-variables-backendenv)
   - [Frontend Environment Variables (`frontend/.env.local`)](#frontend-environment-variables-frontendenvlocal)
10. [Step-by-Step Installation & Quickstart](#10-step-by-step-installation--quickstart)
    - [Option A: One-Click Launchers (Windows .bat)](#option-a-one-click-launchers-windows-bat)
    - [Option B: Manual Terminal Setup](#option-b-manual-terminal-setup)
11. [Database Seeding & Heavy Load Testing](#11-database-seeding--heavy-load-testing)
12. [Production Deployment Guide](#12-production-deployment-guide)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)

---

## 1. Executive Overview & Core Value

Textile operations typically struggle with fragmented spreadsheets, mismatched stock numbers between dyeing plants and warehouses, delayed vendor payments, and disconnected payroll. **Textile ERP** eliminates departmental silos by ensuring that every event in the factory directly and automatically updates downstream departments:

- **Procurement buys raw yarn/greige fabric** $\rightarrow$ Quality inspection verifies grade $\rightarrow$ Warehouse stock automatically increases with moving average costing.
- **Production order executes against a Bill of Materials (BOM)** $\rightarrow$ Raw materials are consumed and deducted from inventory $\rightarrow$ Finished goods (dyed fabric, finished garments) are received into stock $\rightarrow$ Scrap & yield percentages are captured.
- **Sales order confirms and ships** $\rightarrow$ Reserved stock transitions to delivery $\rightarrow$ Finished goods inventory decrements $\rightarrow$ Accounts Receivable and Sales Revenue journal entries are instantly generated.
- **Employees clock in and out** $\rightarrow$ Leave days and attendance are calculated $\rightarrow$ Payroll engine applies earnings, deductions, and statutory levies $\rightarrow$ Salary expense and payable accounts update in the General Ledger.

```
+---------------------------------------------------------------------------------------+
|                                    TEXTILE ERP SUITE                                  |
+---------------------------------------------------------------------------------------+
|  [ Master Data ] ---> [ Sourcing & PO ] ---> [ Goods Receipt / GRN ] ---> [ Stock ]  |
|         |                                                                    |        |
|         v                                                                    v        |
|  [ HR / Payroll ]                                                     [ Production ]  |
|         |                                                             (BOM + QC + WIP)|
|         v                                                                    |        |
|  [ General Ledger ] <--- [ Double-Entry Engine ] <--- [ Sales Orders & Delivery ]    |
+---------------------------------------------------------------------------------------+
```

---

## 2. Technology Stack

### Frontend Architecture
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) — server and client component hybrid model, lightning-fast transitions, and optimized bundle sizes.
- **Runtime & Language**: React 19, TypeScript 5.
- **Styling & Design System**:
  - [Tailwind CSS v4](https://tailwindcss.com/) with CSS variables and full Light/Dark mode switching.
  - [shadcn/ui](https://ui.shadcn.com/) accessible primitives built on `@base-ui/react` and Radix foundations.
  - [Lucide React](https://lucide.dev/) consistent enterprise iconography.
  - [Framer Motion 12](https://www.framer.com/motion/) smooth micro-interactions, statistics card transitions, and dialog reveals.
- **Data Fetching & State**:
  - [TanStack Query v5 (React Query)](https://tanstack.com/query/latest) — optimistic updates, background caching, and automatic invalidation.
  - [TanStack Table v8](https://tanstack.com/table/latest) — high-performance virtualized data tables, sorting, pagination, and multi-column filtering.
  - [Zustand 5](https://github.com/pmndrs/zustand) — lightweight reactive client-side store.
- **Form Management & Validation**: [React Hook Form 7](https://react-hook-form.com/) combined with [Zod 4](https://zod.dev/) for client-side and server-safe schema validation.
- **Charts & Data Visualizations**: [Recharts 3](https://recharts.org/) for real-time revenue breakdowns, monthly trends, and production yield analytics.
- **Document Exporting**:
  - [jsPDF](https://github.com/parallax/jsPDF) & [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) for client-side styled vector PDF report generation.
  - [XLSX (SheetJS)](https://sheetjs.com/) for native `.xlsx` workbook generation.

### Backend Architecture
- **Framework**: [NestJS 11](https://nestjs.com/) — modular enterprise TypeScript framework adhering to SOLID and Clean Architecture principles.
- **Language**: TypeScript 5 running on Node.js 20+.
- **Database ORM**: [Prisma 7.8](https://www.prisma.io/) with custom client extensions (`tenant-isolation`) for automated row-level security.
- **API Documentation**: Automated OpenAPI/Swagger specification exposed live at `/api/docs`.
- **Validation & Transformation**:
  - `class-validator` and `class-transformer` for strict DTO ingress validation with whitelist filtering.
  - Global `TransformInterceptor` standardizing all responses into uniform JSON envelopes `{ success: true, message: "...", data: {...}, meta: {...} }`.
  - Global `AllExceptionsFilter` translating internal database and validation errors into friendly HTTP status payloads.
- **Security & Utilities**:
  - [Helmet](https://helmetjs.github.io/) HTTP header hardening.
  - `@nestjs/throttler` rate limiting protection (100 req/min per IP).
  - CORS security policies with configurable origin whitelists.

### Database, Storage & Caching
- **Primary Database**: [PostgreSQL 16](https://www.postgresql.org/) with ACID compliance, relational integrity, foreign key constraints, and JSONB fields for audit snapshots.
- **Caching & Queuing**: [Redis 7](https://redis.io/) for fast in-memory query caching and background job execution.
- **Containerization**: Official Docker Alpine images for Postgres (`postgres:16-alpine`) and Redis (`redis:7-alpine`).

### Authentication, Security & Multi-Tenancy
- **Authentication Engine**: [Supabase Auth](https://supabase.com/) supporting JWT tokens, Magic Link logins, and email/password authentication.
- **Instant Admin Access (Bypass Key)**: Built-in `DEV_LOGIN_KEY` instant authentication bypass that functions offline and during Supabase email quota limits.
- **Dev-Mode Middleware**: Seamless local offline developer mode (`x-dev-mode: true`) injecting an authenticated tenant mock user into the request pipeline.
- **Role-Based Access Control (RBAC)**: Fine-grained access control with default roles (`admin`, `manager`, `staff`) plus dynamic, page-level entitlement overrides stored in user metadata.

---

## 3. System Architecture & Design Patterns

### Tenant Isolation & Prisma Client Extension
The backend incorporates a multi-tenant isolation layer that guarantees tenant safety without requiring developers to manually write `where: { companyId }` on every database call.

1. **AsyncLocalStorage (`TenantContext`)**: When an incoming request arrives, the `TenantInterceptor` extracts the user's `companyId` and role from the authenticated JWT session and binds it to Node.js's native `AsyncLocalStorage`.
2. **Prisma Client Extension (`tenantExtension`)**:
   - **Reads (`findMany`, `findFirst`, `count`, `aggregate`)**: Automatically injects `{ companyId }` into the Prisma query's `where` clause. If no company context exists, the query safely matches zero records (`__no_company_context__`).
   - **Writes (`create`, `createMany`)**: Automatically injects `companyId` into the payload data.
   - **Platform Bypass**: Requests made by `PLATFORM_OWNER` or system background jobs automatically bypass tenant filtering when appropriate.

```
Incoming HTTP Request (Bearer JWT / x-dev-mode)
  │
  ▼
DevModeMiddleware / SupabaseAuthGuard
  │  (Validates token & extracts user.companyId)
  ▼
TenantInterceptor
  │  (Wraps execution in TenantContext.run(store, ...))
  ▼
Controller -> Service Logic
  │
  ▼
Extended PrismaClient ($allOperations hook)
  │  (Injects where.companyId = currentCompanyId)
  ▼
PostgreSQL Database (Isolated Tenant Data)
```

### In-Memory Event Bus & Domain Events
Cross-module communication is decoupled using an asynchronous `EventBus`. When state changes occur in one module, domain events are published without tight coupling:
- `PurchaseOrderApprovedEvent`: Listened to by Finance for creating Accounts Payable entries.
- `InventoryUpdatedEvent`: Triggers stock re-calculation, audit trail logging, and low-stock alerts.
- `ProductionCompletedEvent`: Notifies shop-floor supervisors and updates inventory ledger.
- `SalesOrderConfirmedEvent`: Auto-reserves inventory and generates production demand if stock is depleted.
- `PayrollProcessedEvent`: Triggers General Ledger salary expense postings.

### Automated General Ledger Integration
Unlike traditional systems that require manual month-end journal entries, Textile ERP features an **Automated Finance Integration Engine** (`FinanceIntegrationService`):
- Every financial transaction verifies that the company's Chart of Accounts contains the required system accounts (e.g., `INVENTORY`, `ACCOUNTS_PAYABLE`, `ACCOUNTS_RECEIVABLE`, `SALES_REVENUE`, `SALARY_EXPENSE`, `SALARY_PAYABLE`). If missing, it auto-provisions them.
- Balanced double-entry transactions are enforced inside atomic database transactions (`totalDebit === totalCredit`).

---

## 4. End-to-End Business Workflows

### Procure-to-Pay (P2P) Flow
```mermaid
sequenceDiagram
    autonumber
    actor Dept as Department Officer
    actor PurMgr as Purchase Manager
    actor Whs as Warehouse Inspector
    participant API as Textile ERP API
    participant DB as PostgreSQL
    participant Fin as General Ledger

    Dept->>API: 1. Create Demand Note (e.g., 5000 kg Cotton Yarn)
    PurMgr->>API: 2. Request & Record Vendor Quotations
    PurMgr->>API: 3. Issue Purchase Order (PO) to Best Vendor
    PurMgr->>API: 4. Approve Purchase Order
    API->>Fin: Auto-create Journal Entry (Dr. Inventory / Cr. Accounts Payable)
    Whs->>API: 5. Create Goods Receiving Note (GRN) on delivery
    API->>DB: Validate (receivedQty <= orderedQty & acceptedQty <= receivedQty)
    API->>DB: Increment WarehouseStock & Create StockLedger (GRN_RECEIPT)
    API->>DB: Update PO received quantities & mark status (COMPLETED)
```

### Manufacturing & Bill of Materials (BOM) Flow
```mermaid
sequenceDiagram
    autonumber
    actor Plan as Production Planner
    actor Floor as Shop-Floor Operator
    actor QC as Quality Inspector
    participant API as Textile ERP API
    participant Stock as Inventory & Stock Ledger

    Plan->>API: 1. Define Bill of Materials (e.g., 1m Finished Denim = 1.2kg Yarn + Dye + Chemical)
    Plan->>API: 2. Create Production Order (e.g., 10,000 meters Denim)
    API->>API: Auto-calculate planned material consumption from BOM
    Floor->>API: 3. Start Production (Status: IN_PROGRESS)
    QC->>API: 4. Perform Quality Checks (Tensile Strength, GSM, Color Fastness)
    Floor->>API: 5. Mark Production Order Completed (producedQty: 9,800, rejectedQty: 200)
    API->>Stock: Deduct Raw Materials (PRODUCTION_ISSUE)
    API->>Stock: Increment Finished Goods (PRODUCTION_RECEIPT)
    API->>API: Compute final yield percentage (96.08%)
```

### Order-to-Cash (O2C) Sales Flow
```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Officer
    actor Cust as Wholesale Customer
    participant API as Textile ERP API
    participant Stock as Warehouse Inventory
    participant Fin as General Ledger

    Sales->>API: 1. Create Sales Order (SO) with pricing & payment terms
    API->>Stock: Check Available Stock vs Required Qty
    alt Stock Available
        Sales->>API: 2. Confirm Sales Order -> Reserve Stock in Warehouse
    else Stock Insufficient
        API->>API: Alert User / Auto-create Production Order from BOM
    end
    API->>Fin: Auto-create Journal Entry (Dr. Accounts Receivable / Cr. Sales Revenue)
    Sales->>API: 3. Deliver Sales Order
    API->>Stock: Deduct Finished Goods from Warehouse (SALES_ISSUE)
    API->>API: Update SO status to DELIVERED
```

### HR Attendance, Leaves & Payroll Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor Emp as Employee / Biometric Device
    actor HR as HR Manager
    participant API as Textile ERP API
    participant Fin as General Ledger

    Emp->>API: 1. Daily Clock-in / Clock-out (Status: PRESENT, LATE, HALF_DAY)
    Emp->>API: 2. Apply for Leave (Casual, Sick, Annual, Maternity)
    HR->>API: 3. Approve / Reject Leave
    HR->>API: 4. Open Monthly Payroll Period (e.g., "July 2026")
    HR->>API: 5. Generate Pay Slips (Basic Pay + Earnings - Deductions)
    HR->>API: 6. Process Payroll Period
    API->>Fin: Auto-create Journal Entry (Dr. Salary Expense / Cr. Salary Payable)
```

---

## 5. Comprehensive Module Walkthrough

The platform is partitioned into ten business domains and three administrative subsystems:

### 1. Master Data Management
The foundational registry of all organizational data:
- **Company Registry**: Legal entity name, tax/NTN/GST registration, phone, address, and branding logos.
- **Multi-Branch Support**: Factory units, spinning mills, processing plants, and corporate offices.
- **Department Hierarchy**: Spinning, Weaving, Dyeing, Quality Control, Warehouse, Accounting, Human Resources.
- **Designation & Grading System**: Job titles, salary bands, and hierarchy levels.
- **Employee Directory**: Full employee profiles, employee code, CNIC/Aadhar/PAN, UAN, direct reporting manager, emergency contacts, and bank disbursement details.

### 2. Inventory & Multi-Warehouse Management
Complete tracking of textile raw materials, work-in-progress (WIP), and finished items:
- **Item Master**: Full catalog of textile goods (Raw Cotton, Polyester Staple Fiber, Yarn Counts, Greige Fabric, Dyestuffs, Auxiliary Chemicals, Finished Garments).
- **Categories & Units**: Hierarchical categories and UOMs (Kilograms, Meters, Rolls, Pounds, Liters, Cones, Dozens).
- **Stock Tracking & Reorder Levels**: Real-time current stock, reserved stock, available stock, min/max thresholds, and automated reorder alerts.
- **Moving Average Costing**: Automatically calculates moving average inventory cost on every GRN receipt.
- **Warehouse Transfers**: Inter-warehouse stock transfers with two-stage ledger verification (`TRANSFER_OUT` and `TRANSFER_IN`).
- **Comprehensive Stock Ledger**: Immutable transaction log tracking every single physical stock movement with `qtyBefore`, `qtyChange`, `qtyAfter`, and associated transaction reference.

### 3. Procurement & Purchase Management
Manages supplier procurement with full 3-way matching:
- **Vendor Master**: Supplier directory with contact persons, tax numbers, credit days, and performance ratings.
- **Vendor-Item Price Mapping**: Preferred vendor assignments, item lead times, and minimum order quantities.
- **Demand Notes (Internal Requisitions)**: Departmental purchase requests with urgency flags (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Vendor Quotations**: Quotation comparison matrix evaluating pricing, delivery times, and payment terms.
- **Purchase Orders (PO)**: Formal binding purchase orders with itemized pricing, tax percentages, shipping costs, and multi-tier approval workflows (`DRAFT` $\rightarrow$ `APPROVED`).
- **Goods Receiving Notes (GRN)**: Receipt verification capturing `orderedQty`, `receivedQty`, `acceptedQty`, and `rejectedQty` with rejection reasons.

### 4. Production & Manufacturing Management
Tailored specifically for textile processing plants:
- **Bill of Materials (BOM)**: Multi-component material recipes specifying exact ingredient quantities, waste margins (`wastePct`), scrap allowances (`scrapPct`), and cost sharing.
- **Production Orders (MO)**: Batch manufacturing orders with target quantities, start/end dates, priorities, and assigned factory supervisors.
- **Lifecycle Tracking**: `PLANNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `ON_HOLD` $\rightarrow$ `COMPLETED` / `CANCELLED`.
- **Material Consumption Tracking**: Automatic variance calculation between planned BOM quantities and actual consumed materials.
- **Quality Control (QC) Gate**: Pre-delivery and in-line inspections with custom parameters (Tensile Strength, GSM, Shrinkage, Color Fastness, Defect Counts) and status tracking (`PASS`, `FAIL`, `REWORK`, `PENDING`).

### 5. Sales & Customer Order Management
Wholesale, retail, and export sales pipelines:
- **Customer Master**: Client profiles, shipping addresses, credit limits, payment terms, and ratings.
- **Sales Orders (SO)**: Multi-line sales orders with line-item discounts, tax calculations, and scheduled delivery dates.
- **Automated Stock Reservation**: Confirmed sales orders automatically reserve physical stock in warehouse inventory.
- **Make-to-Order Auto-Production**: If available stock is insufficient to fulfill a confirmed sales order, the system can automatically spawn a production order from the item's active BOM.
- **Delivery & Fulfillment**: Dispatches finished goods from warehouse locations, creating `SALES_ISSUE` stock ledger entries and updating financial accounts.

### 6. Finance, Accounting & General Ledger
Enterprise-grade double-entry bookkeeping:
- **Chart of Accounts (COA)**: Five primary account types:
  - `ASSET` (Cash, Bank, Accounts Receivable, Raw Material Inventory, Finished Goods Inventory)
  - `LIABILITY` (Accounts Payable, Salary Payable, Sales Tax Payable)
  - `EQUITY` (Retained Earnings, Shareholder Capital)
  - `INCOME` (Sales Revenue, Export Incentives, Miscellaneous Income)
  - `EXPENSE` (Cost of Goods Sold, Salary Expense, Utility Bills, Freight)
- **Balanced Journal Entries**: Journal vouchers requiring equal total debits and credits with audit metadata.
- **General Ledger**: Filterable transaction ledgers showing historic postings, running balances, and document references.
- **Automated Sub-Ledger Posting**: Zero-click financial journal generation for Purchase Orders, Sales Orders, and Payroll.

### 7. Human Resources & Payroll
End-to-end workforce lifecycle management:
- **Daily Attendance Tracking**: Clock-in and clock-out logs with status flags (`PRESENT`, `ABSENT`, `HALF_DAY`, `LATE`, `HOLIDAY`, `LEAVE`).
- **Leave Management**: Leave requests and approval workflow covering `CASUAL`, `SICK`, `ANNUAL`, `MATERNITY`, `PATERNITY`, and `UNPAID` leaves.
- **Payhead Configuration**: Dynamic salary components configured as `EARNING` (Basic, HRA, Medical, Overtime), `DEDUCTION` (Provident Fund, Tax, Advances), or `STATUTORY` (EOBI, Social Security).
- **Payroll Periods & Automated Processing**: Monthly payroll calculation factoring attendance days, active payheads, gross pay, deductions, and net pay.
- **Individual Pay Slips**: Printable and exportable employee pay slips.

### 8. Analytics, Dashboards & Reporting Suite
Real-time visibility into executive KPIs and operational data:
- **Executive KPI Dashboard**: Live counts and trends for Purchase Orders, Inventory Items, Pending Approvals, Sales Orders, Production Orders, and Active Employees.
- **Monthly Revenue Visualizer**: Dynamic interactive bar chart powered by Recharts plotting monthly revenue and order volume.
- **Comprehensive Reporting Suite**: 18 pre-built analytical reports across 6 business domains:
  - *Purchase*: Purchase Order Summary, Vendor Performance, Demand Note Analysis.
  - *Inventory*: Stock Status Report, Low Stock Alerts, Inventory Valuation.
  - *Sales*: Sales Order Summary, Customer Analysis, Revenue Report.
  - *Production*: Production Summary, BOM Cost Analysis, Quality Report.
  - *Finance*: Trial Balance, Profit & Loss (P&L), Balance Sheet.
  - *HR*: Attendance Summary, Leave Analysis, Payroll Summary.
- **One-Click Export**: High-resolution, branded PDF documents (with headers, timestamps, and styled tables) and clean `.xlsx` Excel spreadsheets.

### 9. Role Management & Access Control (RBAC)
- **Role Hierarchy**: Preconfigured roles (`admin`, `manager`, `staff`) with configurable permissions.
- **Page-Level Entitlement Control**: Administrators can check or uncheck individual page permissions for each role or user from the **Role Management** UI (`/role-management`).
- **Sidebar & Route Guard Enforcement**: Navigation menus and server-side Next.js middleware automatically restrict unauthorized routes.

### 10. Audit Logging, Activity Tracking & Backups
- **Audit Logs (`/activity`)**: Records who performed what action (`CREATED`, `UPDATED`, `DELETED`, `APPROVED`, `POSTED`), affected entity, timestamp, IP address, user agent, and full JSON diffs of `oldValue` vs `newValue`.
- **System Backups (`/backups`)**: Generates complete database snapshots stored as portable JSON records, enabling one-click export and point-in-time state inspection.

---

## 6. API Reference & REST Endpoints Catalog

All backend endpoints are prefixed with `/api/v1` and protected by `SupabaseAuthGuard` (or `DevModeMiddleware` in non-production). Live Swagger documentation is accessible at `http://localhost:4000/api/docs`.

### Authentication & Tenant Sync (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/sync` | Syncs current Supabase user into the local database and provisions tenant context |
| `POST` | `/auth/register-company` | Registers a new company tenant and links the root owner user |

### Master Data (`/master-data`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/master-data/company` | Retrieve or update company details |
| `GET`/`POST` | `/master-data/branch` | List all branches or register a new branch |
| `GET`/`POST` | `/master-data/department` | List or create organizational departments |
| `GET`/`POST` | `/master-data/designation` | List or create employee designations |
| `GET`/`POST` | `/master-data/employee` | Query employee directory (supports status/search filters) |
| `GET`/`PATCH`| `/master-data/employee/:id` | Fetch employee detail or update profile |

### Inventory & Warehouse (`/inventory`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/inventory/items` | List paginated items or create a new inventory item |
| `GET`/`PATCH`| `/inventory/items/:id` | Get item details (including stock & valuation) or update item |
| `GET`/`POST` | `/inventory/categories` | Manage item categories (Yarn, Fabric, Dye, Chemicals) |
| `GET`/`POST` | `/inventory/units` | Manage units of measure (Kg, Meter, Roll, Piece, Liter) |
| `GET`/`POST` | `/inventory/warehouses` | List or register physical warehouse locations |
| `POST` | `/inventory/stock/receive` | Manual or GRN stock receipt into warehouse |
| `POST` | `/inventory/stock/issue` | Issue stock out of warehouse |
| `POST` | `/inventory/stock/transfer` | Transfer stock between two warehouses |
| `POST` | `/inventory/stock/adjust` | Record stock adjustments with audit reason |
| `GET` | `/inventory/stock/ledger` | Retrieve historical immutable stock ledger entries |

### Purchase & Sourcing (`/purchase`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/purchase/vendors` | List or create suppliers/vendors |
| `POST` | `/purchase/vendors/:id/items` | Associate items with vendor and configure pricing/lead-time |
| `GET`/`POST` | `/purchase/demand-notes` | List or submit departmental purchase demand requisitions |
| `GET`/`POST` | `/purchase/quotations` | Record and compare vendor price quotations |
| `GET`/`POST` | `/purchase/orders` | List or create formal Purchase Orders |
| `GET` | `/purchase/orders/:id` | Get Purchase Order details with line items |
| `POST` | `/purchase/orders/:id/approve` | Approve Purchase Order (triggers auto GL posting) |
| `GET`/`POST` | `/purchase/goods-receiving` | List or record Goods Receiving Notes (GRN) with stock updates |

### Production & Manufacturing (`/production`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/production/bom` | List or define Bills of Materials (BOM) with recipes |
| `GET`/`POST` | `/production/orders` | List or launch batch Production Orders |
| `GET` | `/production/orders/:id` | Get Production Order with consumption and QC status |
| `POST` | `/production/orders/:id/start` | Transition order status to `IN_PROGRESS` |
| `POST` | `/production/orders/:id/hold` | Put production on hold |
| `POST` | `/production/orders/:id/resume` | Resume stalled production |
| `POST` | `/production/orders/:id/complete` | Complete order: deducts raw materials, receives finished goods |
| `GET`/`POST` | `/production/quality` | Record quality inspection results (`PASS`/`FAIL`/`REWORK`) |

### Sales & Distribution (`/sales`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/sales/customers` | Manage wholesale customer registry |
| `GET`/`POST` | `/sales/orders` | List or draft new Sales Orders |
| `GET` | `/sales/orders/:id` | Get Sales Order detail with customer and line items |
| `POST` | `/sales/orders/:id/confirm` | Confirm order (auto-reserves stock or spawns production) |
| `POST` | `/sales/orders/:id/deliver` | Dispatch order: issues stock and posts financial entries |

### Financial Accounting (`/finance`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/finance/accounts` | Query Chart of Accounts or add a new general account |
| `GET`/`POST` | `/finance/journal-entries` | List or post balanced double-entry journal vouchers |
| `GET` | `/finance/journal-entries/:id` | Get journal entry with all line-item debits and credits |

### Human Resources & Payroll (`/hr`)
| Method | Endpoint | Description |
|---|---|---|
| `GET`/`POST` | `/hr/attendance` | Retrieve or record daily employee clock-in/out logs |
| `GET`/`POST` | `/hr/leaves` | List or submit employee leave requests |
| `POST` | `/hr/leaves/:id/approve` | Approve leave application |
| `POST` | `/hr/leaves/:id/reject` | Reject leave application |
| `GET`/`POST` | `/hr/payroll/payhead` | Manage salary payheads (Earnings, Deductions, Statutory) |
| `GET`/`POST` | `/hr/payroll/period` | Manage monthly payroll processing periods |
| `GET`/`POST` | `/hr/payroll/slip` | Generate individual employee pay slips |
| `POST` | `/hr/payroll/process/:id` | Finalize monthly payroll and post salary expense journal |

### Analytics & System Administration
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/revenue` | Get monthly revenue breakdown and order counts for charts |
| `GET` | `/audit-log` | Query system audit trails with pagination, actor, and entity |
| `GET`/`POST` | `/backup` | List available backups or trigger an immediate JSON snapshot |
| `GET` | `/backup/:id/download` | Export specific backup payload |
| `GET`/`POST` | `/notifications` | Query or acknowledge user notifications |

---

## 7. Database Schema & Entity Relationship Overview

The PostgreSQL database is organized into 27 strongly-typed Prisma models and 8 enums:

```
[ Company ]
   │
   ├── [ Branch ] ────────── [ Department ]
   │      │                         │
   │      └── [ Warehouse ]         └── [ Employee ] ── [ User ] ── [ UserRole ] ── [ Role ]
   │                 │                        │                                       │
   │                 ├── [ WarehouseStock ]   ├── [ Attendance ]              [ RolePermission ]
   │                 └── [ StockLedger ]      ├── [ Leave ]                           │
   │                                          └── [ PaySlip ] ── [ PaySlipItem ] [ Permission ]
   │
   ├── [ Category ] ── [ Item ] ────────────── [ BillOfMaterial ] ── [ BOMMaterial ]
   ├── [ Unit ] ─────────┘   │                         │
   │                         ├── [ PurchaseOrderItem ] └── [ ProductionOrder ]
   │                         ├── [ GoodsReceivingItem ]            │
   │                         ├── [ SalesOrderItem ]                ├── [ MaterialConsumption ]
   │                         └── [ VendorItem ]                    └── [ QualityCheck ]
   │
   ├── [ Vendor ] ─── [ DemandNote ] ── [ VendorQuotation ] ── [ PurchaseOrder ] ── [ GoodsReceivingNote ]
   ├── [ Customer ] ─ [ SalesOrder ]
   ├── [ Account ] ── [ JournalEntry ] ── [ JournalEntryItem ]
   ├── [ Payhead ]
   ├── [ PayrollPeriod ]
   ├── [ AuditLog ]
   ├── [ Notification ]
   └── [ Backup ]
```

### Key Database Models & Descriptions
1. `Company`: Tenant root with tax identifiers, multi-branch, and configuration.
2. `User`, `Role`, `Permission`, `UserRole`, `RolePermission`: Complete granular RBAC security model.
3. `Employee`: HR personnel master linking directly to user logins, designations, and departments.
4. `Warehouse` & `WarehouseStock`: Multi-location storage tracking quantity on hand and moving average cost.
5. `StockLedger`: Immutable physical movement record with audit before/after quantity tracking.
6. `Item`: Unified SKU catalog for raw materials, chemicals, yarns, fabrics, and finished garments.
7. `BillOfMaterial` & `BOMMaterial`: Multi-ingredient manufacturing recipes with scrap and waste percentages.
8. `ProductionOrder`, `MaterialConsumption`, `QualityCheck`: Manufacturing execution and quality inspection.
9. `DemandNote`, `VendorQuotation`, `PurchaseOrder`, `GoodsReceivingNote`: 3-way matching procurement pipeline.
10. `Customer` & `SalesOrder`: Wholesale order booking, credit validation, and stock allocation.
11. `Account` & `JournalEntry`: Full double-entry general ledger with hierarchical account relationships.
12. `Attendance`, `Leave`, `Payhead`, `PayrollPeriod`, `PaySlip`: Automated attendance and payroll calculations.
13. `AuditLog` & `Backup`: Enterprise audit trails with JSON snapshots of state changes.

---

## 8. Repository Directory Structure

```
textile-erp/
├── docker-compose.yml              # Local Postgres 16 & Redis 7 containers
├── seed-all.mjs                    # Comprehensive multi-module data seeder & load test
├── seed-all.ps1                    # PowerShell runner for seed script
├── run-dev.bat                     # Launches backend (:4000) and frontend (:3000) in dev mode
├── run-prod.bat                    # Builds and launches production servers with admin keys
├── start-db.bat                    # Boots Docker database & applies Prisma migrations
├── start-production.bat            # Production launcher script
├── start-servers.bat               # Fast concurrent process starter
│
├── backend/                        # NestJS Enterprise API
│   ├── prisma/
│   │   ├── schema.prisma           # 27 models, 8 enums, indices, and relationships
│   │   └── migrations/             # Generated SQL migration history
│   ├── src/
│   │   ├── common/                 # Shared cross-cutting concerns
│   │   │   ├── decorators/         # @Company(), @GetUser()
│   │   │   ├── events/             # DomainEvent, EventBus
│   │   │   ├── filters/            # AllExceptionsFilter
│   │   │   ├── interceptors/       # TransformInterceptor (standard JSON envelopes)
│   │   │   ├── middleware/         # DevModeMiddleware (offline dev bypass)
│   │   │   ├── services/           # AuditLog, Dashboard, Notification, Search
│   │   │   ├── tenant/             # TenantContext (AsyncLocalStorage), TenantInterceptor
│   │   │   └── utils/              # enrichWithCreator, pagination
│   │   ├── database/               # PrismaModule, PrismaService, tenantExtension
│   │   ├── modules/
│   │   │   ├── audit-log/          # Audit trail controller and query service
│   │   │   ├── auth/               # Supabase strategy, sync, company registration
│   │   │   ├── backup/             # JSON snapshot backup and restore controller
│   │   │   ├── finance/            # Accounts, Journal Entries, FinanceIntegrationService
│   │   │   ├── hr/                 # Attendance, Leave, Payroll, Payheads, Payslips
│   │   │   ├── inventory/          # Items, Categories, Units, Warehouses, StockService
│   │   │   ├── master-data/        # Company, Branch, Department, Designation, Employee
│   │   │   ├── production/         # BOM, Production Orders, Quality Control
│   │   │   ├── purchase/           # Demand Notes, Quotations, POs, GRNs, Vendors
│   │   │   └── sales/              # Customers, Sales Orders, Order Delivery
│   │   ├── app.module.ts           # Root NestJS module wiring
│   │   └── main.ts                 # Bootstrap, Swagger, CORS, Helmet, ValidationPipe
│   ├── e2e/
│   │   └── flows.mjs               # End-to-end integration test runner
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                       # Next.js 16 Web Application
    ├── public/                     # Static icons, brand graphics, SVG assets
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/             # Authentication route group
    │   │   │   ├── login/          # Email Magic Link & Instant Dev Key Login
    │   │   │   └── forgot-password/# Password recovery flow
    │   │   ├── (dashboard)/        # Authenticated App Shell route group
    │   │   │   ├── activity/       # Audit trail viewer
    │   │   │   ├── backups/        # System backup manager
    │   │   │   ├── customers/      # Customer directory
    │   │   │   ├── dashboard/      # Executive KPI overview & Recharts revenue chart
    │   │   │   ├── finance/        # Chart of accounts, journal entries, general ledger
    │   │   │   ├── help/           # ERP user guide and support documentation
    │   │   │   ├── hr/             # Attendance, leave approvals, payroll periods & slips
    │   │   │   ├── inventory/      # Item master, categories, units, transfers, stock ledger
    │   │   │   ├── master-data/    # Company, branches, departments, designations, employees
    │   │   │   ├── production/     # BOMs, production orders, quality check inspections
    │   │   │   ├── purchase/       # Demand notes, quotations, POs, GRN receiving, vendors
    │   │   │   ├── reports/        # 18+ reports with PDF & Excel export
    │   │   │   ├── role-management/# Granular user and page access control
    │   │   │   ├── sales/          # Sales orders and fulfillment
    │   │   │   ├── settings/       # System preferences and company settings
    │   │   │   ├── vendors/        # Vendor directory shortcut
    │   │   │   └── warehouse/      # Warehouse list and stock transfer manager
    │   │   ├── layout.tsx          # Root HTML layout with font and theme providers
    │   │   └── globals.css         # Tailwind v4 utility and CSS theme variables
    │   ├── components/
    │   │   ├── layouts/            # AppShell, Sidebar, Topbar
    │   │   ├── reports/            # ReportDialog preview and export controls
    │   │   ├── shared/             # DataTable, ErrorBoundary, ThemeToggle, Columns
    │   │   └── ui/                 # Accessible shadcn UI component primitives
    │   ├── lib/
    │   │   ├── access.ts           # Page entitlement resolvers & defaults
    │   │   ├── api/                # Axios-free native fetch client with auto-JWT headers
    │   │   ├── reports/            # jsPDF & SheetJS export utilities
    │   │   ├── roles.ts            # Role definitions & type guards
    │   │   └── utils.ts            # Currency formatting, cn helper, date utilities
    │   ├── providers/              # React Query, ThemeProvider, Toast notifications
    │   ├── utils/supabase/         # Supabase browser, server, admin, and middleware clients
    │   └── middleware.ts           # Next.js edge route protection & dev-mode cookie check
    ├── package.json
    └── tsconfig.json
```

---

## 9. Prerequisites & Environment Configuration

### Prerequisites
- **Node.js**: `v20.x` or higher (tested on Node 20 & 22).
- **Package Manager**: `npm` (v9+) or `pnpm`.
- **Docker & Docker Compose**: Docker Desktop (for PostgreSQL and Redis).
- **Supabase Account**: A free Supabase project from [supabase.com](https://supabase.com) (or use local dev mode).

### Backend Environment Variables (`backend/.env`)

Create `backend/.env` with the following keys:

```env
# Server Port
PORT=4000

# PostgreSQL Database Connection URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/textile_erp?schema=public

# Supabase Auth Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# JWT Security
JWT_SECRET=textile-erp-super-secret-jwt-token-2026
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=86400

# Allowed CORS Origins (comma-separated)
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment Variables (`frontend/.env.local`)

Create `frontend/.env.local` with the following keys:

```env
# Public Supabase Client (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY

# Default Administrator Email
NEXT_PUBLIC_ADMIN_EMAIL=admin@textileerp.com

# Backend API Endpoint
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Instant Login Bypass Key (Allows one-click login without email quota limits)
DEV_LOGIN_KEY=ZbcEtL48Xw10Y6CYfDw0PUrTyGQKzyVqi5iJeC5WU

# Server-Only Supabase Secret (NEVER expose to browser)
# SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

---

## 10. Step-by-Step Installation & Quickstart

### Option A: One-Click Launchers (Windows .bat)

If working on Windows, three pre-configured launchers handle the entire sequence:

1. **Start Database**: Double-click `start-db.bat`
   - Spawns Docker containers for PostgreSQL (`localhost:5432`) and Redis (`localhost:6379`).
   - Automatically executes `npx prisma db push` to synchronize database schemas.
2. **Start Development**: Double-click `run-dev.bat`
   - Spawns Backend on `http://localhost:4000` with hot-reload watch mode.
   - Spawns Frontend on `http://localhost:3000` with Next.js development server.
3. **Start Production**: Double-click `run-prod.bat`
   - Builds optimized production bundles for backend and frontend.
   - Starts both in production mode.

### Option B: Manual Terminal Setup

#### 1. Start Database Containers
```bash
# From project root
docker compose up -d
```

#### 2. Setup and Launch Backend
```bash
cd backend

# Install dependencies
npm install

# Generate Prisma Client & apply schema
npx prisma generate
npx prisma db push

# Start in development mode
npm run start:dev
```
*The API is now running at `http://localhost:4000` and Swagger documentation is at `http://localhost:4000/api/docs`.*

#### 3. Setup and Launch Frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
*The Web App is now accessible at `http://localhost:3000`.*

#### 4. Logging In as Administrator
Navigate to `http://localhost:3000/login`:
- **Method 1 (Instant Login — Recommended)**:
  Click **⚡ Admin Login**, paste your `DEV_LOGIN_KEY` (e.g. `ZbcEtL48Xw10Y6CYfDw0PUrTyGQKzyVqi5iJeC5WU`), and click **Instant Login**. This authenticates immediately without sending emails or consuming rate limits.
- **Method 2 (Email Magic Link)**:
  Enter your administrator email and click **Send Magic Link**.

---

## 11. Database Seeding & Heavy Load Testing

The repository includes a comprehensive, multi-phase seeding script (`seed-all.mjs`) that populates every single department, generates realistic textile data, and performs a heavy load benchmark.

```bash
# Run seeder with default volume (scale factor N=1 ~ 50-100 records per entity)
node seed-all.mjs 1

# Run heavy load test (scale factor N=5 ~ 500 records per entity)
node seed-all.mjs 5
```

### What `seed-all.mjs` Performs:
1. **Master Data**: Seeds Departments, Designations, Branches, and Employees.
2. **Inventory**: Provisions 10 textile units (Meter, Kg, Piece, Roll, Ton, etc.), 10 categories (Yarn, Fabric, Thread, Dye, Chemicals, etc.), items with reorder levels, and multiple warehouses.
3. **Procurement**: Registers vendors, links supplier items, submits Demand Notes, records Quotations, generates Purchase Orders, executes PO approval, and files Goods Receiving Notes (GRNs) with physical stock updates.
4. **Manufacturing**: Creates Bills of Materials (BOM), launches batch Production Orders, records quality checks (Tensile strength, GSM), and simulates production yields.
5. **Sales**: Enrolls wholesale customers and creates Sales Orders.
6. **Finance**: Auto-configures the Chart of Accounts and posts balanced double-entry Journal Entries.
7. **Human Resources**: Records attendance clock-in/out records, leave requests, dynamic payheads, payroll periods, and calculated payslips.
8. **High-Volume Benchmark**: Queries 22 critical read endpoints with 1,000 records each, asserting that response times remain strictly under 3 seconds.

---

## 12. Production Deployment Guide

### Architecture for Production Deployment
```
                         [ Internet / Clients ]
                                   │
                                   ▼
                         [ Nginx Reverse Proxy ]
                       (SSL Termination + Gzip)
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
     [ Next.js Frontend ]                    [ NestJS Backend ]
       (Port 3000 Node)                        (Port 4000 Node)
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    ▼                                   ▼
                           [ PostgreSQL 16 ]                     [ Redis 7 ]
                             (Port 5432)                           (Port 6379)
```

### 1. Build Production Binaries
```bash
# Build Backend
cd backend
npm run build

# Build Frontend
cd ../frontend
npm run build
```

### 2. Sample Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name erp.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/erp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.yourdomain.com/privkey.pem;

    # Frontend Next.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Process Management (PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Start backend cluster
cd backend
pm2 start dist/src/main.js --name "textile-erp-backend" -i max

# Start frontend Next.js server
cd ../frontend
pm2 start npm --name "textile-erp-frontend" -- start -- -p 3000

# Save PM2 process list
pm2 save
pm2 startup
```

---

## 13. Troubleshooting & FAQ

### 1. `Cannot reach the server. Is the backend running on http://localhost:4000?`
- Verify the backend is running by navigating to `http://localhost:4000/api/docs`.
- Check if port 4000 is occupied by another application:
  ```powershell
  netstat -ano | findstr :4000
  ```
- Ensure `backend/.env` has `PORT=4000` and `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`.

### 2. Database Connection Errors (`P1001: Can't reach database server`)
- Verify Docker is running:
  ```bash
  docker ps
  ```
- If `textile-erp-db` is not listed, run:
  ```bash
  docker compose up -d
  ```

### 3. Supabase Magic Link Email Rate Limiting
- Supabase free tier imposes strict hourly email limits.
- **Solution**: Use the built-in **Instant Login** on the login page (`/login`) with your `DEV_LOGIN_KEY`. It bypasses SMTP restrictions and logs you in instantly with full administrator privileges.

### 4. Prisma Migration Sync
- If database schema adjustments are made in `schema.prisma`:
  ```bash
  cd backend
  npx prisma generate
  npx prisma db push
  ```

---

## License

This project is licensed under the Proprietary Enterprise License. All rights reserved. Designed and engineered for high-throughput textile manufacturing and supply chain management.
