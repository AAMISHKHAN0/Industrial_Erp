--
-- PostgreSQL database dump
--

\restrict rVZGHC4tanl0ldAjezi7I2kS3ZTcOR67WYro0nlCf2gs71jpzdBT8sX5jH7omCI

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountType" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'INCOME',
    'EXPENSE'
);


ALTER TYPE public."AccountType" OWNER TO postgres;

--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'LATE',
    'HOLIDAY',
    'LEAVE'
);


ALTER TYPE public."AttendanceStatus" OWNER TO postgres;

--
-- Name: BOMStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BOMStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."BOMStatus" OWNER TO postgres;

--
-- Name: LeaveStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeaveStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."LeaveStatus" OWNER TO postgres;

--
-- Name: LeaveType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeaveType" AS ENUM (
    'CASUAL',
    'SICK',
    'ANNUAL',
    'MATERNITY',
    'PATERNITY',
    'UNPAID',
    'OTHER'
);


ALTER TYPE public."LeaveType" OWNER TO postgres;

--
-- Name: PayheadType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PayheadType" AS ENUM (
    'EARNING',
    'DEDUCTION',
    'STATUTORY'
);


ALTER TYPE public."PayheadType" OWNER TO postgres;

--
-- Name: ProductionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProductionStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'ON_HOLD'
);


ALTER TYPE public."ProductionStatus" OWNER TO postgres;

--
-- Name: QualityStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QualityStatus" AS ENUM (
    'PASS',
    'FAIL',
    'REWORK',
    'PENDING'
);


ALTER TYPE public."QualityStatus" OWNER TO postgres;

--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TransactionType" AS ENUM (
    'GRN_RECEIPT',
    'SALES_ISSUE',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'PRODUCTION_ISSUE',
    'PRODUCTION_RECEIPT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'ADJUSTMENT_PLUS',
    'ADJUSTMENT_MINUS',
    'INITIAL_STOCK'
);


ALTER TYPE public."TransactionType" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'DISABLED',
    'PENDING_VERIFICATION'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: accounting_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounting_periods (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isClosed" boolean DEFAULT false NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "closedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.accounting_periods OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "accountCode" text NOT NULL,
    name text NOT NULL,
    type public."AccountType" NOT NULL,
    "parentId" text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    balance double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "clockIn" timestamp(3) without time zone,
    "clockOut" timestamp(3) without time zone,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "userId" text,
    "userName" text,
    "userEmail" text,
    action text NOT NULL,
    entity text NOT NULL,
    "entityId" text,
    "oldValue" jsonb,
    "newValue" jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: backups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backups (
    id text NOT NULL,
    filename text NOT NULL,
    label text DEFAULT 'manual'::text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.backups OWNER TO postgres;

--
-- Name: bill_of_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bill_of_materials (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "bomNumber" text NOT NULL,
    "itemId" text NOT NULL,
    description text,
    quantity double precision DEFAULT 1 NOT NULL,
    unit text,
    "wastePct" double precision DEFAULT 0 NOT NULL,
    status public."BOMStatus" DEFAULT 'ACTIVE'::public."BOMStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.bill_of_materials OWNER TO postgres;

--
-- Name: bom_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bom_materials (
    id text NOT NULL,
    "bomId" text NOT NULL,
    "itemId" text NOT NULL,
    quantity double precision NOT NULL,
    unit text,
    "scrapPct" double precision DEFAULT 0 NOT NULL,
    "costShare" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.bom_materials OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    email text,
    phone text,
    address text,
    city text,
    state text,
    country text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    logo text,
    "taxNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: customer_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_receipts (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "receiptNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "receiptDate" timestamp(3) without time zone NOT NULL,
    "paymentMethod" text DEFAULT 'CASH'::text NOT NULL,
    "amountReceived" double precision DEFAULT 0 NOT NULL,
    "taxWithheld" double precision DEFAULT 0 NOT NULL,
    "totalSettled" double precision DEFAULT 0 NOT NULL,
    "withholdingCertificate" text,
    "withholdingSection" text,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "chequeNumber" text,
    "chequeDate" timestamp(3) without time zone,
    "chequeBank" text,
    "chequeStatus" text DEFAULT 'NONE'::text NOT NULL,
    "clearedDate" timestamp(3) without time zone,
    "returnReason" text,
    "voucherId" text,
    "reversalVoucherId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.customer_receipts OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "customerCode" text NOT NULL,
    name text NOT NULL,
    "contactPerson" text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    country text,
    "paymentTerms" text,
    "taxNumber" text,
    rating double precision,
    "creditLimit" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: demand_note_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demand_note_items (
    id text NOT NULL,
    "demandId" text NOT NULL,
    "itemId" text,
    description text,
    quantity double precision NOT NULL,
    unit text,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.demand_note_items OWNER TO postgres;

--
-- Name: demand_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demand_notes (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "demandNumber" text NOT NULL,
    "departmentId" text,
    "requestedBy" text,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    "requiredDate" timestamp(3) without time zone,
    remarks text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.demand_notes OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "branchId" text,
    name text NOT NULL,
    code text,
    description text,
    "headEmployeeId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: designations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designations (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    grade text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.designations OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "employeeCode" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text NOT NULL,
    phone text,
    gender text,
    "dateOfBirth" timestamp(3) without time zone,
    "joiningDate" timestamp(3) without time zone,
    address text,
    city text,
    state text,
    country text,
    "postalCode" text,
    "departmentId" text,
    "designationId" text,
    "reportsTo" text,
    avatar text,
    "bankName" text,
    "bankAccount" text,
    "bankIfsc" text,
    "panNumber" text,
    "aadharNumber" text,
    "uanNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: fifo_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fifo_allocations (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "layerId" text NOT NULL,
    "stockMovementId" text,
    quantity numeric(20,4) NOT NULL,
    "unitCost" numeric(20,4) NOT NULL,
    "allocatedValue" numeric(20,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.fifo_allocations OWNER TO postgres;

--
-- Name: fifo_layers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fifo_layers (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "itemId" text NOT NULL,
    "sourceMovementId" text,
    "receiptDate" timestamp(3) without time zone NOT NULL,
    sequence integer NOT NULL,
    "originalQty" numeric(20,4) NOT NULL,
    "remainingQty" numeric(20,4) NOT NULL,
    "unitCost" numeric(20,4) NOT NULL,
    "trackedValue" numeric(20,2) NOT NULL,
    "sourceLot" text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.fifo_layers OWNER TO postgres;

--
-- Name: goods_receiving_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goods_receiving_items (
    id text NOT NULL,
    "grnId" text NOT NULL,
    "poItemId" text,
    "itemId" text,
    "orderedQty" double precision NOT NULL,
    "receivedQty" double precision NOT NULL,
    "acceptedQty" double precision NOT NULL,
    "rejectedQty" double precision DEFAULT 0 NOT NULL,
    "rejectionReason" text,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.goods_receiving_items OWNER TO postgres;

--
-- Name: goods_receiving_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goods_receiving_notes (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "grnNumber" text NOT NULL,
    "poId" text NOT NULL,
    "vendorId" text NOT NULL,
    "warehouseId" text,
    "receivedDate" timestamp(3) without time zone,
    "receivedBy" text,
    notes text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.goods_receiving_notes OWNER TO postgres;

--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.idempotency_keys (
    id text NOT NULL,
    "companyId" text NOT NULL,
    action text NOT NULL,
    "requestKey" text NOT NULL,
    "payloadHash" text NOT NULL,
    status text DEFAULT 'PROCESSING'::text NOT NULL,
    "resultId" text,
    "responsePayload" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone
);


ALTER TABLE public.idempotency_keys OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "itemCode" text NOT NULL,
    name text NOT NULL,
    description text,
    "categoryId" text,
    "unitId" text,
    brand text,
    "minStock" double precision,
    "maxStock" double precision,
    "reorderLevel" double precision,
    "purchasePrice" double precision,
    "sellingPrice" double precision,
    "currentStock" double precision DEFAULT 0 NOT NULL,
    "reservedStock" double precision DEFAULT 0 NOT NULL,
    "availableStock" double precision DEFAULT 0 NOT NULL,
    "averageCost" double precision DEFAULT 0 NOT NULL,
    "hsnCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "entryNumber" text NOT NULL,
    "entryDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reference text,
    description text,
    "isPosted" boolean DEFAULT false NOT NULL,
    "postedAt" timestamp(3) without time zone,
    "postedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text,
    "updatedBy" text,
    "periodId" text,
    "voucherId" text
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- Name: journal_entry_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entry_items (
    id text NOT NULL,
    "journalEntryId" text NOT NULL,
    "accountId" text NOT NULL,
    "debitAmount" double precision DEFAULT 0 NOT NULL,
    "creditAmount" double precision DEFAULT 0 NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.journal_entry_items OWNER TO postgres;

--
-- Name: leaves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leaves (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "leaveType" public."LeaveType" NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    reason text,
    status public."LeaveStatus" DEFAULT 'PENDING'::public."LeaveStatus" NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    remarks text,
    "createdBy" text,
    "updatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.leaves OWNER TO postgres;

--
-- Name: material_consumptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_consumptions (
    id text NOT NULL,
    "productionOrderId" text NOT NULL,
    "itemId" text NOT NULL,
    "plannedQty" double precision NOT NULL,
    "actualQty" double precision,
    unit text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.material_consumptions OWNER TO postgres;

--
-- Name: material_issue_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_issue_items (
    id text NOT NULL,
    "issueId" text NOT NULL,
    "demandNoteItemId" text,
    "itemId" text NOT NULL,
    quantity double precision NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.material_issue_items OWNER TO postgres;

--
-- Name: material_issues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_issues (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "issueNumber" text NOT NULL,
    "demandNoteId" text,
    "warehouseId" text NOT NULL,
    "issueDate" timestamp(3) without time zone NOT NULL,
    "issuedBy" text,
    "departmentId" text,
    "costCenter" text,
    notes text,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "voucherId" text,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.material_issues OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    link text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: pay_slip_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pay_slip_items (
    id text NOT NULL,
    "paySlipId" text NOT NULL,
    "payheadId" text NOT NULL,
    amount double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.pay_slip_items OWNER TO postgres;

--
-- Name: pay_slips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pay_slips (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "periodId" text NOT NULL,
    "basicPay" double precision DEFAULT 0 NOT NULL,
    "totalEarnings" double precision DEFAULT 0 NOT NULL,
    "totalDeductions" double precision DEFAULT 0 NOT NULL,
    "netPay" double precision DEFAULT 0 NOT NULL,
    "grossPay" double precision DEFAULT 0 NOT NULL,
    "presentDays" integer DEFAULT 0 NOT NULL,
    "totalDays" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    notes text,
    "createdBy" text,
    "updatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.pay_slips OWNER TO postgres;

--
-- Name: payheads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payheads (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type public."PayheadType" NOT NULL,
    description text,
    amount double precision,
    percentage double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" text,
    "updatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payheads OWNER TO postgres;

--
-- Name: payroll_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_periods (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isProcessed" boolean DEFAULT false NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "processedBy" text,
    "createdBy" text,
    "updatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payroll_periods OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    module text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: production_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_orders (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "productionNumber" text NOT NULL,
    "itemId" text NOT NULL,
    "bomId" text,
    quantity double precision NOT NULL,
    "producedQty" double precision DEFAULT 0 NOT NULL,
    "rejectedQty" double precision DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "assignedTo" text,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    notes text,
    status public."ProductionStatus" DEFAULT 'PLANNED'::public."ProductionStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.production_orders OWNER TO postgres;

--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id text NOT NULL,
    "poId" text NOT NULL,
    "itemId" text,
    description text,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "discountPct" double precision DEFAULT 0 NOT NULL,
    "taxPct" double precision DEFAULT 0 NOT NULL,
    "totalPrice" double precision NOT NULL,
    "receivedQty" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "poNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "demandNoteId" text,
    "quotationId" text,
    "orderDate" timestamp(3) without time zone,
    "expectedDelivery" timestamp(3) without time zone,
    "paymentTerms" text,
    "shippingCost" double precision DEFAULT 0 NOT NULL,
    "discountAmount" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "grandTotal" double precision DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_return_items (
    id text NOT NULL,
    "returnId" text NOT NULL,
    "itemId" text NOT NULL,
    quantity double precision NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_return_items OWNER TO postgres;

--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_returns (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "returnNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "grnId" text,
    "supplierBillId" text,
    "debitNoteNumber" text,
    "returnDate" timestamp(3) without time zone NOT NULL,
    "gatePassNumber" text,
    reason text,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "voucherId" text,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.purchase_returns OWNER TO postgres;

--
-- Name: quality_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_checks (
    id text NOT NULL,
    "productionOrderId" text NOT NULL,
    "checkedBy" text,
    "checkDate" timestamp(3) without time zone,
    parameter text NOT NULL,
    specification text,
    result text,
    status public."QualityStatus" DEFAULT 'PENDING'::public."QualityStatus" NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.quality_checks OWNER TO postgres;

--
-- Name: receipt_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipt_allocations (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "receiptId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "allocatedAmount" double precision NOT NULL,
    "allocatedWithholding" double precision DEFAULT 0 NOT NULL,
    "totalAllocated" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.receipt_allocations OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: sales_dispatch_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_dispatch_items (
    id text NOT NULL,
    "dispatchId" text NOT NULL,
    "itemId" text NOT NULL,
    quantity double precision NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    "soItemId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sales_dispatch_items OWNER TO postgres;

--
-- Name: sales_dispatches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_dispatches (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "dispatchNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "soId" text,
    "dispatchDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'DISPATCHED'::text NOT NULL,
    "voucherId" text,
    "totalCost" double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.sales_dispatches OWNER TO postgres;

--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_invoice_items (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    "itemId" text,
    description text,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "taxPct" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "lineTotal" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sales_invoice_items OWNER TO postgres;

--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_invoices (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "invoiceNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "soId" text,
    "dispatchId" text,
    "invoiceDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "voucherId" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "withheldAmount" double precision DEFAULT 0 NOT NULL,
    "outstandingAmount" double precision DEFAULT 0 NOT NULL,
    "customerTaxId" text,
    "billingAddress" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.sales_invoices OWNER TO postgres;

--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_order_items (
    id text NOT NULL,
    "soId" text NOT NULL,
    "itemId" text,
    description text,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "discountPct" double precision DEFAULT 0 NOT NULL,
    "taxPct" double precision DEFAULT 0 NOT NULL,
    "totalPrice" double precision NOT NULL,
    "deliveredQty" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sales_order_items OWNER TO postgres;

--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_orders (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "soNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "orderDate" timestamp(3) without time zone,
    "expectedDelivery" timestamp(3) without time zone,
    "paymentTerms" text,
    "shippingCost" double precision DEFAULT 0 NOT NULL,
    "discountAmount" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "grandTotal" double precision DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.sales_orders OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "lastActivity" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: statutory_obligations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statutory_obligations (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "obligationNumber" text NOT NULL,
    head text NOT NULL,
    authority text NOT NULL,
    "registrationNumber" text,
    "taxPeriod" text NOT NULL,
    "dueAmount" double precision NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    "outstandingAmount" double precision NOT NULL,
    "dueDate" timestamp(3) without time zone,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "assessmentReference" text,
    "challanNumber" text,
    psid text,
    "voucherId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


ALTER TABLE public.statutory_obligations OWNER TO postgres;

--
-- Name: statutory_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statutory_payments (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "paymentNumber" text NOT NULL,
    "obligationId" text NOT NULL,
    "paymentDate" timestamp(3) without time zone NOT NULL,
    amount double precision NOT NULL,
    "paymentMethod" text DEFAULT 'BANK'::text NOT NULL,
    "cprNumber" text,
    psid text,
    "bankReference" text,
    "evidenceUrl" text,
    "evidenceStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "voucherId" text,
    status text DEFAULT 'POSTED'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


ALTER TABLE public.statutory_payments OWNER TO postgres;

--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_ledger (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "itemId" text NOT NULL,
    "warehouseId" text,
    "transactionType" public."TransactionType" NOT NULL,
    "referenceId" text,
    "referenceType" text,
    "qtyBefore" double precision NOT NULL,
    "qtyChange" double precision NOT NULL,
    "qtyAfter" double precision NOT NULL,
    "costBefore" double precision,
    "costChange" double precision,
    "costAfter" double precision,
    notes text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stock_ledger OWNER TO postgres;

--
-- Name: supplier_bill_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_bill_items (
    id text NOT NULL,
    "billId" text NOT NULL,
    "grnId" text,
    "grnItemId" text,
    "poItemId" text,
    "itemId" text NOT NULL,
    "billedQty" double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "lineTotal" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.supplier_bill_items OWNER TO postgres;

--
-- Name: supplier_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_bills (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "billNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "supplierInvoiceNumber" text NOT NULL,
    "supplierInvoiceDate" timestamp(3) without time zone,
    "billDate" timestamp(3) without time zone NOT NULL,
    "dueDate" timestamp(3) without time zone,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "voucherId" text,
    subtotal double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "paidAmount" double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.supplier_bills OWNER TO postgres;

--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "roleId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    "companyId" text NOT NULL,
    role text DEFAULT 'MEMBER'::text NOT NULL,
    email text NOT NULL,
    password text,
    "employeeId" text,
    "firebaseUid" text,
    "isEmailVerified" boolean DEFAULT false NOT NULL,
    status public."UserStatus" DEFAULT 'PENDING_VERIFICATION'::public."UserStatus" NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "loginCount" integer DEFAULT 0 NOT NULL,
    "refreshToken" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendor_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_items (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "vendorId" text NOT NULL,
    "itemId" text NOT NULL,
    "preferredSupplier" boolean DEFAULT false NOT NULL,
    "leadTimeDays" integer,
    "minimumOrderQuantity" double precision,
    "unitPrice" double precision,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.vendor_items OWNER TO postgres;

--
-- Name: vendor_quotation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_quotation_items (
    id text NOT NULL,
    "quotationId" text NOT NULL,
    "itemId" text,
    description text,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "discountPct" double precision DEFAULT 0 NOT NULL,
    "taxPct" double precision DEFAULT 0 NOT NULL,
    "totalPrice" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_quotation_items OWNER TO postgres;

--
-- Name: vendor_quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_quotations (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "quotationNumber" text NOT NULL,
    "vendorId" text NOT NULL,
    "demandNoteId" text,
    "quotationDate" timestamp(3) without time zone,
    "deliveryTime" integer,
    warranty text,
    notes text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.vendor_quotations OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "vendorCode" text NOT NULL,
    name text NOT NULL,
    "contactPerson" text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    country text,
    "bankName" text,
    "bankAccount" text,
    "bankIfsc" text,
    "paymentTerms" text,
    "taxNumber" text,
    rating double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vouchers (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "branchId" text,
    "voucherNumber" text NOT NULL,
    "voucherType" text NOT NULL,
    "businessDate" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'POSTED'::text NOT NULL,
    "periodId" text,
    reference text,
    notes text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "reversalOfVoucherId" text
);


ALTER TABLE public.vouchers OWNER TO postgres;

--
-- Name: wage_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wage_lines (
    id text NOT NULL,
    "wageRunId" text NOT NULL,
    "employeeId" text NOT NULL,
    "daysWorked" double precision NOT NULL,
    "dailyRate" double precision NOT NULL,
    "grossAmount" double precision NOT NULL,
    deductions double precision DEFAULT 0 NOT NULL,
    "netAmount" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wage_lines OWNER TO postgres;

--
-- Name: wage_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wage_runs (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "runNumber" text NOT NULL,
    "periodMonth" integer NOT NULL,
    "periodYear" integer NOT NULL,
    "runType" text DEFAULT 'MONTHLY'::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "totalAmount" double precision DEFAULT 0 NOT NULL,
    "voucherId" text,
    "disbursementVoucherId" text,
    "disbursedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" text
);


ALTER TABLE public.wage_runs OWNER TO postgres;

--
-- Name: warehouse_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_stock (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "warehouseId" text NOT NULL,
    "itemId" text NOT NULL,
    quantity double precision DEFAULT 0 NOT NULL,
    "averageCost" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.warehouse_stock OWNER TO postgres;

--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "branchId" text,
    name text NOT NULL,
    code text NOT NULL,
    address text,
    city text,
    state text,
    country text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdBy" text,
    "updatedBy" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5fa2cd72-c451-499b-b978-3a6e4559cd33	775f307017631f07e3bdc191c22caed2acb76e26cb9c3c30d945ed42a135a562	2026-11-22 19:55:39.10213+05	0_init	\N	\N	2026-11-22 19:55:39.10213+05	1
0cf10ede-315a-4363-a0eb-68492f3f596d	3ea2f8efe568fa524c108d20e70cb18b596e1dd469ef2e417487f2b5f3ebd315	2026-11-22 19:55:39.791359+05	20261120183000_m2_posting_models	\N	\N	2026-11-22 19:55:39.791359+05	1
58c969aa-f0ce-432a-97d0-ed03a44be90e	d4d2527391d173e2948ef6f61bd5f47d2255c779b96523882b9b3a46b3e8942a	2026-11-22 19:55:39.900104+05	20261121041000_add_voucher_reversal	\N	\N	2026-11-22 19:55:39.900104+05	1
924d56c9-9d59-4581-b0ce-bdfe121a9dfd	324686a1e1af3d3f90fbbee25b5d6e58fdbeace153ed24c010978eaeddda0221	2026-11-22 19:55:39.916803+05	20261121110000_m4_m5_models	\N	\N	2026-11-22 19:55:39.916803+05	1
\.


--
-- Data for Name: accounting_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounting_periods (id, "companyId", name, "startDate", "endDate", "isClosed", "closedAt", "closedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts (id, "companyId", "accountCode", name, type, "parentId", description, "isActive", balance, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
b5cc8cd1-bba8-408e-b16e-af52b018c8cc	a98c125d-3be9-46dc-873f-bc32f59df19e	INVENTORY	Inventory	ASSET	\N	\N	t	0	2026-11-22 14:57:08.471	2026-11-22 14:57:08.471	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
6ca45f2d-99a3-4201-b9af-91985f114fdf	a98c125d-3be9-46dc-873f-bc32f59df19e	ACCOUNTS_PAYABLE	Accounts Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.48	2026-11-22 14:57:08.48	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
030cc4c7-2b0e-43bc-9ac0-c8ff95ddf6d5	a98c125d-3be9-46dc-873f-bc32f59df19e	ACCOUNTS_RECEIVABLE	Accounts Receivable	ASSET	\N	\N	t	0	2026-11-22 14:57:08.483	2026-11-22 14:57:08.483	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
54076af5-7fb9-4ba9-9712-79556db9ae1d	a98c125d-3be9-46dc-873f-bc32f59df19e	SALES_REVENUE	Sales Revenue	INCOME	\N	\N	t	0	2026-11-22 14:57:08.487	2026-11-22 14:57:08.487	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
aa69f818-aecd-4a62-99cf-d9d42c53f97f	a98c125d-3be9-46dc-873f-bc32f59df19e	SALARY_EXPENSE	Salary Expense	EXPENSE	\N	\N	t	0	2026-11-22 14:57:08.491	2026-11-22 14:57:08.491	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
6b8bedcf-af93-4d71-9001-a54f8a42f0e8	a98c125d-3be9-46dc-873f-bc32f59df19e	SALARY_PAYABLE	Salary Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.494	2026-11-22 14:57:08.494	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
214cf4e5-1f3a-4f4f-8c8b-501049bfe47a	a98c125d-3be9-46dc-873f-bc32f59df19e	CASH	Cash	ASSET	\N	\N	t	0	2026-11-22 14:57:08.496	2026-11-22 14:57:08.496	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
e02cd786-1c6e-45ae-a503-9e61bbc9e802	a98c125d-3be9-46dc-873f-bc32f59df19e	BANK	Bank	ASSET	\N	\N	t	0	2026-11-22 14:57:08.499	2026-11-22 14:57:08.499	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
4804497d-6a99-439d-8266-a4fa9668dc95	a98c125d-3be9-46dc-873f-bc32f59df19e	GRNI	Goods Received Not Invoiced	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.501	2026-11-22 14:57:08.501	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
25af1d4f-7afc-4b9a-b6c8-6ce989ce9a50	a98c125d-3be9-46dc-873f-bc32f59df19e	COGS	Cost of Goods Sold	EXPENSE	\N	\N	t	0	2026-11-22 14:57:08.504	2026-11-22 14:57:08.504	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
d6bb3d05-fa43-4e18-a609-b369fd8a598a	a98c125d-3be9-46dc-873f-bc32f59df19e	SALES_TAX_PAYABLE	Sales Tax Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.506	2026-11-22 14:57:08.506	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
f0873cd7-3e5c-4aa3-8858-714c8683335a	a98c125d-3be9-46dc-873f-bc32f59df19e	INPUT_TAX_RECEIVABLE	Input Tax Receivable	ASSET	\N	\N	t	0	2026-11-22 14:57:08.508	2026-11-22 14:57:08.508	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
d26fe794-73c5-4e29-a8f6-9b80df3c1aca	a98c125d-3be9-46dc-873f-bc32f59df19e	PAYROLL_DEDUCTIONS	Payroll Deductions Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.51	2026-11-22 14:57:08.51	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
66c420b2-dae5-4455-8d4b-84ee36a655a6	a98c125d-3be9-46dc-873f-bc32f59df19e	DEPARTMENT_EXPENSE	Department Expense	EXPENSE	\N	\N	t	0	2026-11-22 14:57:08.512	2026-11-22 14:57:08.512	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
dc857b8e-1736-4dc1-9aad-912728e445b2	a98c125d-3be9-46dc-873f-bc32f59df19e	WIP	Work in Progress	ASSET	\N	\N	t	0	2026-11-22 14:57:08.515	2026-11-22 14:57:08.515	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
fd8fc0fd-f715-4dbb-bcf7-c83f9ec0829e	a98c125d-3be9-46dc-873f-bc32f59df19e	WITHHOLDING_TAX_RECEIVABLE	Withholding Tax Receivable	ASSET	\N	\N	t	0	2026-11-22 14:57:08.518	2026-11-22 14:57:08.518	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
da8bcaf9-4d5a-4b6c-8819-7d4b0c011cb6	a98c125d-3be9-46dc-873f-bc32f59df19e	UNCLEARED_CHEQUES	Uncleared Cheques	ASSET	\N	\N	t	0	2026-11-22 14:57:08.519	2026-11-22 14:57:08.519	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
71af05b7-5c47-41f1-9301-0932d1f51e25	a98c125d-3be9-46dc-873f-bc32f59df19e	STATUTORY_PAYABLE	Statutory Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.521	2026-11-22 14:57:08.521	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
d138faab-1d81-449e-a259-91efb1f908f3	a98c125d-3be9-46dc-873f-bc32f59df19e	INCOME_TAX_PAYABLE	Income Tax Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.523	2026-11-22 14:57:08.523	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
c600d99d-0c93-4228-bf9d-6a504d021516	a98c125d-3be9-46dc-873f-bc32f59df19e	PESSI_PAYABLE	PESSI Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.525	2026-11-22 14:57:08.525	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
c6d17754-d05e-403e-88d3-2bcd358b524b	a98c125d-3be9-46dc-873f-bc32f59df19e	PROFESSIONAL_TAX_PAYABLE	Professional Tax Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.527	2026-11-22 14:57:08.527	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
04e1c51a-6c67-4267-9bf6-e9e8152f4c04	a98c125d-3be9-46dc-873f-bc32f59df19e	WAGE_EXPENSE	Wage Expense	EXPENSE	\N	\N	t	0	2026-11-22 14:57:08.53	2026-11-22 14:57:08.53	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
3a5b4534-b67d-4506-b623-61207c8b8d6c	a98c125d-3be9-46dc-873f-bc32f59df19e	WAGE_PAYABLE	Wage Payable	LIABILITY	\N	\N	t	0	2026-11-22 14:57:08.532	2026-11-22 14:57:08.532	\N	5c649ad8-9b63-4e61-b0aa-055970458052	\N	1
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance (id, "employeeId", date, "clockIn", "clockOut", status, remarks, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, "companyId", "userId", "userName", "userEmail", action, entity, "entityId", "oldValue", "newValue", "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: backups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backups (id, filename, label, size, data, "createdAt") FROM stdin;
\.


--
-- Data for Name: bill_of_materials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bill_of_materials (id, "companyId", "bomNumber", "itemId", description, quantity, unit, "wastePct", status, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: bom_materials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bom_materials (id, "bomId", "itemId", quantity, unit, "scrapPct", "costShare", "createdAt") FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, "companyId", name, code, email, phone, address, city, state, country, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, "companyId", name, code, description, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, email, phone, address, logo, "taxNumber", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
a98c125d-3be9-46dc-873f-bc32f59df19e	digitalerena	aamish@digitalerena.com	\N	\N	\N	\N	2026-11-22 14:57:08.039	2026-11-22 14:57:08.039	\N	\N	\N	ACTIVE	1
\.


--
-- Data for Name: customer_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_receipts (id, "companyId", "receiptNumber", "customerId", "receiptDate", "paymentMethod", "amountReceived", "taxWithheld", "totalSettled", "withholdingCertificate", "withholdingSection", status, "chequeNumber", "chequeDate", "chequeBank", "chequeStatus", "clearedDate", "returnReason", "voucherId", "reversalVoucherId", notes, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, "companyId", "customerCode", name, "contactPerson", email, phone, address, city, state, country, "paymentTerms", "taxNumber", rating, "creditLimit", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: demand_note_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.demand_note_items (id, "demandId", "itemId", description, quantity, unit, remarks, "createdAt") FROM stdin;
\.


--
-- Data for Name: demand_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.demand_notes (id, "companyId", "demandNumber", "departmentId", "requestedBy", priority, "requiredDate", remarks, status, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, "companyId", "branchId", name, code, description, "headEmployeeId", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
04a9ba79-b051-4c9b-8163-394d726dbfe4	a98c125d-3be9-46dc-873f-bc32f59df19e	\N	General	\N	\N	\N	2026-11-22 14:57:08.069	2026-11-22 14:57:08.069	\N	\N	\N	ACTIVE	1
\.


--
-- Data for Name: designations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.designations (id, "companyId", name, code, description, grade, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, "companyId", "employeeCode", "firstName", "lastName", email, phone, gender, "dateOfBirth", "joiningDate", address, city, state, country, "postalCode", "departmentId", "designationId", "reportsTo", avatar, "bankName", "bankAccount", "bankIfsc", "panNumber", "aadharNumber", "uanNumber", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: fifo_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fifo_allocations (id, "companyId", "layerId", "stockMovementId", quantity, "unitCost", "allocatedValue", "createdAt") FROM stdin;
\.


--
-- Data for Name: fifo_layers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fifo_layers (id, "companyId", "warehouseId", "itemId", "sourceMovementId", "receiptDate", sequence, "originalQty", "remainingQty", "unitCost", "trackedValue", "sourceLot", status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: goods_receiving_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receiving_items (id, "grnId", "poItemId", "itemId", "orderedQty", "receivedQty", "acceptedQty", "rejectedQty", "rejectionReason", "unitCost", "createdAt") FROM stdin;
\.


--
-- Data for Name: goods_receiving_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receiving_notes (id, "companyId", "grnNumber", "poId", "vendorId", "warehouseId", "receivedDate", "receivedBy", notes, status, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.idempotency_keys (id, "companyId", action, "requestKey", "payloadHash", status, "resultId", "responsePayload", "createdAt", "updatedAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, "companyId", "itemCode", name, description, "categoryId", "unitId", brand, "minStock", "maxStock", "reorderLevel", "purchasePrice", "sellingPrice", "currentStock", "reservedStock", "availableStock", "averageCost", "hsnCode", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_entries (id, "companyId", "entryNumber", "entryDate", reference, description, "isPosted", "postedAt", "postedBy", "createdAt", "updatedAt", "createdBy", "updatedBy", "periodId", "voucherId") FROM stdin;
\.


--
-- Data for Name: journal_entry_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_entry_items (id, "journalEntryId", "accountId", "debitAmount", "creditAmount", description, "createdAt") FROM stdin;
\.


--
-- Data for Name: leaves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leaves (id, "employeeId", "leaveType", "startDate", "endDate", reason, status, "approvedBy", "approvedAt", remarks, "createdBy", "updatedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: material_consumptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_consumptions (id, "productionOrderId", "itemId", "plannedQty", "actualQty", unit, notes, "createdAt") FROM stdin;
\.


--
-- Data for Name: material_issue_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_issue_items (id, "issueId", "demandNoteItemId", "itemId", quantity, "unitCost", "totalCost", remarks, "createdAt") FROM stdin;
\.


--
-- Data for Name: material_issues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_issues (id, "companyId", "issueNumber", "demandNoteId", "warehouseId", "issueDate", "issuedBy", "departmentId", "costCenter", notes, status, "voucherId", "totalCost", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, "companyId", "userId", title, message, type, "isRead", link, "createdAt") FROM stdin;
\.


--
-- Data for Name: pay_slip_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pay_slip_items (id, "paySlipId", "payheadId", amount, "createdAt") FROM stdin;
\.


--
-- Data for Name: pay_slips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pay_slips (id, "employeeId", "periodId", "basicPay", "totalEarnings", "totalDeductions", "netPay", "grossPay", "presentDays", "totalDays", status, notes, "createdBy", "updatedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: payheads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payheads (id, "companyId", name, code, type, description, amount, percentage, "isActive", "createdBy", "updatedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: payroll_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_periods (id, "companyId", name, "startDate", "endDate", "isProcessed", "processedAt", "processedBy", "createdBy", "updatedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, name, code, module, description, "createdAt", "updatedAt", "deletedAt", status, version) FROM stdin;
6716e308-da52-438a-8d77-b677500b547f	master-data:create	MASTER_DATA:CREATE	master-data	create master-data	2026-11-22 14:57:08.107	2026-11-22 14:57:08.107	\N	ACTIVE	1
29dcb503-39b8-43db-9a22-bcabfa5ac900	master-data:read	MASTER_DATA:READ	master-data	read master-data	2026-11-22 14:57:08.11	2026-11-22 14:57:08.11	\N	ACTIVE	1
ecf19a5a-d2ca-43a4-9de7-dd11c10f4d2c	master-data:update	MASTER_DATA:UPDATE	master-data	update master-data	2026-11-22 14:57:08.113	2026-11-22 14:57:08.113	\N	ACTIVE	1
17a7c365-71f3-45c1-ba3b-970a104a14aa	master-data:delete	MASTER_DATA:DELETE	master-data	delete master-data	2026-11-22 14:57:08.115	2026-11-22 14:57:08.115	\N	ACTIVE	1
f43929f6-fb1f-47ff-9e6c-ec5d969fc8a2	inventory:create	INVENTORY:CREATE	inventory	create inventory	2026-11-22 14:57:08.117	2026-11-22 14:57:08.117	\N	ACTIVE	1
b6d2ff27-a3b5-4a21-a54e-20304b45ca7e	inventory:read	INVENTORY:READ	inventory	read inventory	2026-11-22 14:57:08.119	2026-11-22 14:57:08.119	\N	ACTIVE	1
05ec03da-e3ad-47b0-b9f5-78ff37c533fd	inventory:update	INVENTORY:UPDATE	inventory	update inventory	2026-11-22 14:57:08.121	2026-11-22 14:57:08.121	\N	ACTIVE	1
f53f6b29-f2d6-469a-adfd-b53929abbfd2	inventory:delete	INVENTORY:DELETE	inventory	delete inventory	2026-11-22 14:57:08.123	2026-11-22 14:57:08.123	\N	ACTIVE	1
89715244-9b46-47e1-a4ff-b8ffb2d1dc14	warehouse:create	WAREHOUSE:CREATE	warehouse	create warehouse	2026-11-22 14:57:08.125	2026-11-22 14:57:08.125	\N	ACTIVE	1
e7e49e10-92f2-4222-9cd9-58fd15f8771b	warehouse:read	WAREHOUSE:READ	warehouse	read warehouse	2026-11-22 14:57:08.127	2026-11-22 14:57:08.127	\N	ACTIVE	1
aaf23acb-a206-416f-a5ea-13b8cf49bdf1	warehouse:update	WAREHOUSE:UPDATE	warehouse	update warehouse	2026-11-22 14:57:08.128	2026-11-22 14:57:08.128	\N	ACTIVE	1
21c71fe6-13a5-4942-adf8-0a8bfedc5f19	warehouse:delete	WAREHOUSE:DELETE	warehouse	delete warehouse	2026-11-22 14:57:08.131	2026-11-22 14:57:08.131	\N	ACTIVE	1
a271f497-aa37-4d99-9cf6-19c9eabba6b0	purchase:create	PURCHASE:CREATE	purchase	create purchase	2026-11-22 14:57:08.133	2026-11-22 14:57:08.133	\N	ACTIVE	1
765097cf-170c-4e4c-921a-176ab650c618	purchase:read	PURCHASE:READ	purchase	read purchase	2026-11-22 14:57:08.135	2026-11-22 14:57:08.135	\N	ACTIVE	1
593596f6-7f42-443a-8dbf-d381843a6071	purchase:update	PURCHASE:UPDATE	purchase	update purchase	2026-11-22 14:57:08.138	2026-11-22 14:57:08.138	\N	ACTIVE	1
2b80d88b-7f12-4c80-8c6d-56eda58e419d	purchase:delete	PURCHASE:DELETE	purchase	delete purchase	2026-11-22 14:57:08.139	2026-11-22 14:57:08.139	\N	ACTIVE	1
e63d2146-5e52-4b4f-ba20-e4f486ea0bf2	sales:create	SALES:CREATE	sales	create sales	2026-11-22 14:57:08.141	2026-11-22 14:57:08.141	\N	ACTIVE	1
6c60977a-7958-4286-8f5a-c1dcd9b327d9	sales:read	SALES:READ	sales	read sales	2026-11-22 14:57:08.143	2026-11-22 14:57:08.143	\N	ACTIVE	1
bf0ab705-afb5-4af0-8453-ee64bc2955e8	sales:update	SALES:UPDATE	sales	update sales	2026-11-22 14:57:08.145	2026-11-22 14:57:08.145	\N	ACTIVE	1
0f274b14-45b1-4f26-b728-1b8acd4215b8	sales:delete	SALES:DELETE	sales	delete sales	2026-11-22 14:57:08.147	2026-11-22 14:57:08.147	\N	ACTIVE	1
4efae7f3-6b4c-4194-944f-882c33906d72	production:create	PRODUCTION:CREATE	production	create production	2026-11-22 14:57:08.149	2026-11-22 14:57:08.149	\N	ACTIVE	1
bb801315-53fb-41b5-b089-91c9cea73a75	production:read	PRODUCTION:READ	production	read production	2026-11-22 14:57:08.151	2026-11-22 14:57:08.151	\N	ACTIVE	1
43cbe4fc-38d2-4ab3-90be-aee99863bbe6	production:update	PRODUCTION:UPDATE	production	update production	2026-11-22 14:57:08.153	2026-11-22 14:57:08.153	\N	ACTIVE	1
edbeee93-5037-42cf-a9a1-d19babcd8372	production:delete	PRODUCTION:DELETE	production	delete production	2026-11-22 14:57:08.155	2026-11-22 14:57:08.155	\N	ACTIVE	1
625dbd52-d7b9-4d4c-b2c8-f756de0e385f	finance:create	FINANCE:CREATE	finance	create finance	2026-11-22 14:57:08.156	2026-11-22 14:57:08.156	\N	ACTIVE	1
d7823281-e055-4239-a2b2-adb7a58bb66f	finance:read	FINANCE:READ	finance	read finance	2026-11-22 14:57:08.158	2026-11-22 14:57:08.158	\N	ACTIVE	1
446ab6ea-968e-49da-a3e8-9f3abcfc55ec	finance:update	FINANCE:UPDATE	finance	update finance	2026-11-22 14:57:08.16	2026-11-22 14:57:08.16	\N	ACTIVE	1
29de90ac-643c-454a-b847-9d3f7be7a55c	finance:delete	FINANCE:DELETE	finance	delete finance	2026-11-22 14:57:08.162	2026-11-22 14:57:08.162	\N	ACTIVE	1
f7724e55-dc38-448a-bc15-1b093a19aae1	hr:create	HR:CREATE	hr	create hr	2026-11-22 14:57:08.164	2026-11-22 14:57:08.164	\N	ACTIVE	1
96817558-55d2-48cf-8212-56961e29bf71	hr:read	HR:READ	hr	read hr	2026-11-22 14:57:08.166	2026-11-22 14:57:08.166	\N	ACTIVE	1
8fd44d07-aa76-4b04-81ba-6ef975cd6a47	hr:update	HR:UPDATE	hr	update hr	2026-11-22 14:57:08.168	2026-11-22 14:57:08.168	\N	ACTIVE	1
34231719-5067-4cff-8b81-6a33eab5f3d3	hr:delete	HR:DELETE	hr	delete hr	2026-11-22 14:57:08.17	2026-11-22 14:57:08.17	\N	ACTIVE	1
ad08a2ab-61d3-4b55-9d6d-1baa8ca177fe	reports:create	REPORTS:CREATE	reports	create reports	2026-11-22 14:57:08.172	2026-11-22 14:57:08.172	\N	ACTIVE	1
f3888a17-eff6-4b28-8947-c4da172950d3	reports:read	REPORTS:READ	reports	read reports	2026-11-22 14:57:08.174	2026-11-22 14:57:08.174	\N	ACTIVE	1
2e4124c1-cde1-49d5-a20f-e97e8773462d	reports:update	REPORTS:UPDATE	reports	update reports	2026-11-22 14:57:08.175	2026-11-22 14:57:08.175	\N	ACTIVE	1
1708ed71-a656-475f-b82d-a9f16c582b02	reports:delete	REPORTS:DELETE	reports	delete reports	2026-11-22 14:57:08.176	2026-11-22 14:57:08.176	\N	ACTIVE	1
f60b8f20-bf2f-4989-897d-9857b9dc2d60	settings:create	SETTINGS:CREATE	settings	create settings	2026-11-22 14:57:08.178	2026-11-22 14:57:08.178	\N	ACTIVE	1
36e0dfaf-9d8c-4fc5-a4a7-2f807f0fe50e	settings:read	SETTINGS:READ	settings	read settings	2026-11-22 14:57:08.18	2026-11-22 14:57:08.18	\N	ACTIVE	1
299a3558-4afb-450b-ab5a-2b587b6fff85	settings:update	SETTINGS:UPDATE	settings	update settings	2026-11-22 14:57:08.181	2026-11-22 14:57:08.181	\N	ACTIVE	1
5da72452-b0d7-4415-b674-50d29adfca31	settings:delete	SETTINGS:DELETE	settings	delete settings	2026-11-22 14:57:08.185	2026-11-22 14:57:08.185	\N	ACTIVE	1
72b2f531-bba8-4917-8206-256ea4939bc3	users:create	USERS:CREATE	users	create users	2026-11-22 14:57:08.187	2026-11-22 14:57:08.187	\N	ACTIVE	1
55359e39-5477-4a56-9c23-bd5251ede3e7	users:read	USERS:READ	users	read users	2026-11-22 14:57:08.188	2026-11-22 14:57:08.188	\N	ACTIVE	1
078cfc5a-6b54-47be-96fa-3db45f16d438	users:update	USERS:UPDATE	users	update users	2026-11-22 14:57:08.191	2026-11-22 14:57:08.191	\N	ACTIVE	1
74f68499-e4b8-41ca-8cb0-a3a3f3f9849b	users:delete	USERS:DELETE	users	delete users	2026-11-22 14:57:08.193	2026-11-22 14:57:08.193	\N	ACTIVE	1
2b1854cd-acdf-4618-8fc7-823ff4f54789	roles:create	ROLES:CREATE	roles	create roles	2026-11-22 14:57:08.195	2026-11-22 14:57:08.195	\N	ACTIVE	1
4281274a-443f-4a67-877d-21791bfe1d9d	roles:read	ROLES:READ	roles	read roles	2026-11-22 14:57:08.197	2026-11-22 14:57:08.197	\N	ACTIVE	1
0c2085fd-cb75-4b46-bbbd-833b8f63f0cc	roles:update	ROLES:UPDATE	roles	update roles	2026-11-22 14:57:08.198	2026-11-22 14:57:08.198	\N	ACTIVE	1
1e0078ac-1235-4b7c-89a4-54414763f914	roles:delete	ROLES:DELETE	roles	delete roles	2026-11-22 14:57:08.2	2026-11-22 14:57:08.2	\N	ACTIVE	1
cc15adbb-dfc1-4096-bec5-4a677faf6d00	backups:create	BACKUPS:CREATE	backups	create backups	2026-11-22 14:57:08.203	2026-11-22 14:57:08.203	\N	ACTIVE	1
5fc7eec4-6bfa-434f-8487-95a22f91327b	backups:read	BACKUPS:READ	backups	read backups	2026-11-22 14:57:08.205	2026-11-22 14:57:08.205	\N	ACTIVE	1
f55f365a-7c62-4b80-bb06-bc95b5f8ad9a	backups:update	BACKUPS:UPDATE	backups	update backups	2026-11-22 14:57:08.207	2026-11-22 14:57:08.207	\N	ACTIVE	1
9c91bec0-977c-4c76-a674-352bba68f1b7	backups:delete	BACKUPS:DELETE	backups	delete backups	2026-11-22 14:57:08.21	2026-11-22 14:57:08.21	\N	ACTIVE	1
\.


--
-- Data for Name: production_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_orders (id, "companyId", "productionNumber", "itemId", "bomId", quantity, "producedQty", "rejectedQty", "startDate", "endDate", "assignedTo", priority, notes, status, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, "poId", "itemId", description, quantity, "unitPrice", "discountPct", "taxPct", "totalPrice", "receivedQty", "createdAt") FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, "companyId", "poNumber", "vendorId", "demandNoteId", "quotationId", "orderDate", "expectedDelivery", "paymentTerms", "shippingCost", "discountAmount", "taxAmount", "grandTotal", notes, status, "approvedBy", "approvedAt", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: purchase_return_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_return_items (id, "returnId", "itemId", quantity, "unitCost", "totalCost", reason, "createdAt") FROM stdin;
\.


--
-- Data for Name: purchase_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_returns (id, "companyId", "returnNumber", "vendorId", "warehouseId", "grnId", "supplierBillId", "debitNoteNumber", "returnDate", "gatePassNumber", reason, status, "voucherId", "totalAmount", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: quality_checks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_checks (id, "productionOrderId", "checkedBy", "checkDate", parameter, specification, result, status, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: receipt_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receipt_allocations (id, "companyId", "receiptId", "invoiceId", "allocatedAmount", "allocatedWithholding", "totalAllocated", "createdAt") FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, "roleId", "permissionId", "createdAt") FROM stdin;
4218cb59-1ad4-4011-ace7-fc9f74138afe	18315ab6-7053-4fb6-8628-502cddc4ccbb	6716e308-da52-438a-8d77-b677500b547f	2026-11-22 14:57:08.219
591bec72-c9e1-4511-bc29-d41bbb65ccdb	18315ab6-7053-4fb6-8628-502cddc4ccbb	29dcb503-39b8-43db-9a22-bcabfa5ac900	2026-11-22 14:57:08.222
2f302716-cf1c-417c-8e19-49b8230aaf53	18315ab6-7053-4fb6-8628-502cddc4ccbb	ecf19a5a-d2ca-43a4-9de7-dd11c10f4d2c	2026-11-22 14:57:08.224
793620c2-3340-41ef-950a-b03895c4ab24	18315ab6-7053-4fb6-8628-502cddc4ccbb	17a7c365-71f3-45c1-ba3b-970a104a14aa	2026-11-22 14:57:08.226
95985d72-d8c1-46ca-acb6-9a94d4064ef7	18315ab6-7053-4fb6-8628-502cddc4ccbb	f43929f6-fb1f-47ff-9e6c-ec5d969fc8a2	2026-11-22 14:57:08.227
91f5c7a9-4676-43e9-959d-d792bfd57829	18315ab6-7053-4fb6-8628-502cddc4ccbb	b6d2ff27-a3b5-4a21-a54e-20304b45ca7e	2026-11-22 14:57:08.228
3e05399d-6ece-4ead-affb-bd7b4cd8e91d	18315ab6-7053-4fb6-8628-502cddc4ccbb	05ec03da-e3ad-47b0-b9f5-78ff37c533fd	2026-11-22 14:57:08.23
0d5fe0dd-0cd5-4c39-bbcd-3ed948475e92	18315ab6-7053-4fb6-8628-502cddc4ccbb	f53f6b29-f2d6-469a-adfd-b53929abbfd2	2026-11-22 14:57:08.232
3adcc06d-c381-4c64-961f-30f23f9e9889	18315ab6-7053-4fb6-8628-502cddc4ccbb	89715244-9b46-47e1-a4ff-b8ffb2d1dc14	2026-11-22 14:57:08.234
d95ff055-678b-4d58-ab9a-b5de30737f3e	18315ab6-7053-4fb6-8628-502cddc4ccbb	e7e49e10-92f2-4222-9cd9-58fd15f8771b	2026-11-22 14:57:08.235
fa1e942b-cea7-45b5-a21d-09aed01d1ccf	18315ab6-7053-4fb6-8628-502cddc4ccbb	aaf23acb-a206-416f-a5ea-13b8cf49bdf1	2026-11-22 14:57:08.237
a7e0db64-3478-49ec-94ec-d98d77b88a26	18315ab6-7053-4fb6-8628-502cddc4ccbb	21c71fe6-13a5-4942-adf8-0a8bfedc5f19	2026-11-22 14:57:08.238
bc16f6ef-654e-41f4-b8da-1877f4a3652f	18315ab6-7053-4fb6-8628-502cddc4ccbb	a271f497-aa37-4d99-9cf6-19c9eabba6b0	2026-11-22 14:57:08.24
56652804-0b8a-439a-a691-64b006688dd0	18315ab6-7053-4fb6-8628-502cddc4ccbb	765097cf-170c-4e4c-921a-176ab650c618	2026-11-22 14:57:08.241
48390c66-73ba-4d6c-aee9-8a542e1bf83d	18315ab6-7053-4fb6-8628-502cddc4ccbb	593596f6-7f42-443a-8dbf-d381843a6071	2026-11-22 14:57:08.243
f8aa9dfc-a564-43d2-9fe2-21d25ae5ab14	18315ab6-7053-4fb6-8628-502cddc4ccbb	2b80d88b-7f12-4c80-8c6d-56eda58e419d	2026-11-22 14:57:08.245
334773cb-9ffe-4f29-8753-63dbb4d0e7d7	18315ab6-7053-4fb6-8628-502cddc4ccbb	e63d2146-5e52-4b4f-ba20-e4f486ea0bf2	2026-11-22 14:57:08.246
1d445fc1-d699-4df2-a2d1-5643bcc78eb1	18315ab6-7053-4fb6-8628-502cddc4ccbb	6c60977a-7958-4286-8f5a-c1dcd9b327d9	2026-11-22 14:57:08.248
0780fae0-7812-465f-830c-3d0bd854f2c5	18315ab6-7053-4fb6-8628-502cddc4ccbb	bf0ab705-afb5-4af0-8453-ee64bc2955e8	2026-11-22 14:57:08.25
fdec0f3c-f5d8-467d-8dde-8c3cdca0f5e8	18315ab6-7053-4fb6-8628-502cddc4ccbb	0f274b14-45b1-4f26-b728-1b8acd4215b8	2026-11-22 14:57:08.251
f4707537-d3dc-4098-9786-c135af294805	18315ab6-7053-4fb6-8628-502cddc4ccbb	4efae7f3-6b4c-4194-944f-882c33906d72	2026-11-22 14:57:08.253
367f46b1-987b-4508-99cc-76eaef73227c	18315ab6-7053-4fb6-8628-502cddc4ccbb	bb801315-53fb-41b5-b089-91c9cea73a75	2026-11-22 14:57:08.254
265cbc1f-47e2-4160-a4ff-f75b9f919c38	18315ab6-7053-4fb6-8628-502cddc4ccbb	43cbe4fc-38d2-4ab3-90be-aee99863bbe6	2026-11-22 14:57:08.255
cca709ea-8726-402d-8df7-efca7d5235fd	18315ab6-7053-4fb6-8628-502cddc4ccbb	edbeee93-5037-42cf-a9a1-d19babcd8372	2026-11-22 14:57:08.257
b3f3057c-e689-45ec-8329-058be7a885ea	18315ab6-7053-4fb6-8628-502cddc4ccbb	625dbd52-d7b9-4d4c-b2c8-f756de0e385f	2026-11-22 14:57:08.258
65b0488b-9bf4-4d5c-822f-8066d0e9edb3	18315ab6-7053-4fb6-8628-502cddc4ccbb	d7823281-e055-4239-a2b2-adb7a58bb66f	2026-11-22 14:57:08.259
100bc48a-b22b-485c-acb0-ff3ca6fa2198	18315ab6-7053-4fb6-8628-502cddc4ccbb	446ab6ea-968e-49da-a3e8-9f3abcfc55ec	2026-11-22 14:57:08.261
44f7e489-12af-43aa-8c3b-8ff5481ec1d2	18315ab6-7053-4fb6-8628-502cddc4ccbb	29de90ac-643c-454a-b847-9d3f7be7a55c	2026-11-22 14:57:08.263
8831f48a-90bd-4c86-abb6-4eab789630b4	18315ab6-7053-4fb6-8628-502cddc4ccbb	f7724e55-dc38-448a-bc15-1b093a19aae1	2026-11-22 14:57:08.264
56954c69-4fff-4e4e-a4ee-f4a655c9532a	18315ab6-7053-4fb6-8628-502cddc4ccbb	96817558-55d2-48cf-8212-56961e29bf71	2026-11-22 14:57:08.265
dbfb6de2-4df8-4933-928a-079c628f7782	18315ab6-7053-4fb6-8628-502cddc4ccbb	8fd44d07-aa76-4b04-81ba-6ef975cd6a47	2026-11-22 14:57:08.267
7ce0f2cc-01ef-4dc3-8115-7e19d6eddf3e	18315ab6-7053-4fb6-8628-502cddc4ccbb	34231719-5067-4cff-8b81-6a33eab5f3d3	2026-11-22 14:57:08.269
13df249d-7436-4a94-a664-dc03fd032d28	18315ab6-7053-4fb6-8628-502cddc4ccbb	ad08a2ab-61d3-4b55-9d6d-1baa8ca177fe	2026-11-22 14:57:08.27
1a1dddb5-de34-4bd6-8c29-a1cdeb54ba45	18315ab6-7053-4fb6-8628-502cddc4ccbb	f3888a17-eff6-4b28-8947-c4da172950d3	2026-11-22 14:57:08.272
6d71f278-af35-42e3-bb6b-ba084378408c	18315ab6-7053-4fb6-8628-502cddc4ccbb	2e4124c1-cde1-49d5-a20f-e97e8773462d	2026-11-22 14:57:08.273
241cd299-f2ad-48a3-8e9b-f54da9a49786	18315ab6-7053-4fb6-8628-502cddc4ccbb	1708ed71-a656-475f-b82d-a9f16c582b02	2026-11-22 14:57:08.275
7fd80290-4e98-4791-a459-261f5dbc4b0a	18315ab6-7053-4fb6-8628-502cddc4ccbb	f60b8f20-bf2f-4989-897d-9857b9dc2d60	2026-11-22 14:57:08.276
7c5e0773-ecab-4420-98d3-56f7e7ccedd6	18315ab6-7053-4fb6-8628-502cddc4ccbb	36e0dfaf-9d8c-4fc5-a4a7-2f807f0fe50e	2026-11-22 14:57:08.278
4efe7571-c828-4117-b5cc-a3c008bec5ce	18315ab6-7053-4fb6-8628-502cddc4ccbb	299a3558-4afb-450b-ab5a-2b587b6fff85	2026-11-22 14:57:08.279
cc2d9f81-f74e-4918-852b-9e1f4b749612	18315ab6-7053-4fb6-8628-502cddc4ccbb	5da72452-b0d7-4415-b674-50d29adfca31	2026-11-22 14:57:08.28
66ab5473-7faf-4844-a3f3-9bdde03b4949	18315ab6-7053-4fb6-8628-502cddc4ccbb	72b2f531-bba8-4917-8206-256ea4939bc3	2026-11-22 14:57:08.282
967e314e-5eb0-45aa-83f5-e311a89219e3	18315ab6-7053-4fb6-8628-502cddc4ccbb	55359e39-5477-4a56-9c23-bd5251ede3e7	2026-11-22 14:57:08.285
2f6e191c-042a-45cc-9cf7-99efa4944f9b	18315ab6-7053-4fb6-8628-502cddc4ccbb	078cfc5a-6b54-47be-96fa-3db45f16d438	2026-11-22 14:57:08.287
b4143e99-79f4-4c86-86ce-4ade708a4e30	18315ab6-7053-4fb6-8628-502cddc4ccbb	74f68499-e4b8-41ca-8cb0-a3a3f3f9849b	2026-11-22 14:57:08.288
48d46d0a-21ef-4c1b-aa3e-32c043eb9fe8	18315ab6-7053-4fb6-8628-502cddc4ccbb	2b1854cd-acdf-4618-8fc7-823ff4f54789	2026-11-22 14:57:08.29
6853a6b1-5324-48b9-a203-fbd7be5ce48b	18315ab6-7053-4fb6-8628-502cddc4ccbb	4281274a-443f-4a67-877d-21791bfe1d9d	2026-11-22 14:57:08.291
bbdeccb2-f950-4980-b46a-1263a141e8da	18315ab6-7053-4fb6-8628-502cddc4ccbb	0c2085fd-cb75-4b46-bbbd-833b8f63f0cc	2026-11-22 14:57:08.292
22796554-2ce8-49a5-b530-d2b52a609a5c	18315ab6-7053-4fb6-8628-502cddc4ccbb	1e0078ac-1235-4b7c-89a4-54414763f914	2026-11-22 14:57:08.294
5d67b11b-174a-4f71-8564-6bfe8ea1b5f2	18315ab6-7053-4fb6-8628-502cddc4ccbb	cc15adbb-dfc1-4096-bec5-4a677faf6d00	2026-11-22 14:57:08.296
b4587c88-f3cd-477b-8b4d-ebbbe670a517	18315ab6-7053-4fb6-8628-502cddc4ccbb	5fc7eec4-6bfa-434f-8487-95a22f91327b	2026-11-22 14:57:08.297
1dea099c-0867-4904-839d-e254c60640c1	18315ab6-7053-4fb6-8628-502cddc4ccbb	f55f365a-7c62-4b80-bb06-bc95b5f8ad9a	2026-11-22 14:57:08.299
cea90faf-2369-4436-9e0e-ffdc7d481f91	18315ab6-7053-4fb6-8628-502cddc4ccbb	9c91bec0-977c-4c76-a674-352bba68f1b7	2026-11-22 14:57:08.301
c7a1ac29-d305-4c3f-9289-b7d0e0051482	38ae54d8-ad1a-44d6-b414-710f44c81a7c	6716e308-da52-438a-8d77-b677500b547f	2026-11-22 14:57:08.304
b1b0b432-1867-48ae-a7db-5f1ce563c6a2	38ae54d8-ad1a-44d6-b414-710f44c81a7c	29dcb503-39b8-43db-9a22-bcabfa5ac900	2026-11-22 14:57:08.305
ae5d0e18-0cfa-48d7-a307-d8f0d8d925f9	38ae54d8-ad1a-44d6-b414-710f44c81a7c	ecf19a5a-d2ca-43a4-9de7-dd11c10f4d2c	2026-11-22 14:57:08.307
24e36233-af74-4c8a-bcf9-5ad09372c84a	38ae54d8-ad1a-44d6-b414-710f44c81a7c	17a7c365-71f3-45c1-ba3b-970a104a14aa	2026-11-22 14:57:08.311
e8e41215-90ac-4a2c-bff1-7646f0c50bd1	38ae54d8-ad1a-44d6-b414-710f44c81a7c	f43929f6-fb1f-47ff-9e6c-ec5d969fc8a2	2026-11-22 14:57:08.315
25359de1-d3d4-44dd-86fd-b9c9cfee0214	38ae54d8-ad1a-44d6-b414-710f44c81a7c	b6d2ff27-a3b5-4a21-a54e-20304b45ca7e	2026-11-22 14:57:08.318
c06ccfe5-1a31-4808-bf76-3f547ed49a74	38ae54d8-ad1a-44d6-b414-710f44c81a7c	05ec03da-e3ad-47b0-b9f5-78ff37c533fd	2026-11-22 14:57:08.32
c7b1341e-3614-4b48-a3fd-75af37d67192	38ae54d8-ad1a-44d6-b414-710f44c81a7c	f53f6b29-f2d6-469a-adfd-b53929abbfd2	2026-11-22 14:57:08.322
8883d5de-33fd-401d-a990-1778cf4c14d2	38ae54d8-ad1a-44d6-b414-710f44c81a7c	89715244-9b46-47e1-a4ff-b8ffb2d1dc14	2026-11-22 14:57:08.325
15e2d882-6629-4efe-b9e7-cbbf112870a2	38ae54d8-ad1a-44d6-b414-710f44c81a7c	e7e49e10-92f2-4222-9cd9-58fd15f8771b	2026-11-22 14:57:08.328
c3577efe-d997-4ac4-8a29-76a0477fe7c0	38ae54d8-ad1a-44d6-b414-710f44c81a7c	aaf23acb-a206-416f-a5ea-13b8cf49bdf1	2026-11-22 14:57:08.338
966e349c-5e4c-4ce7-9464-006d5d9ba562	38ae54d8-ad1a-44d6-b414-710f44c81a7c	21c71fe6-13a5-4942-adf8-0a8bfedc5f19	2026-11-22 14:57:08.34
0e06a300-e572-4306-a6f1-d522da14f611	38ae54d8-ad1a-44d6-b414-710f44c81a7c	a271f497-aa37-4d99-9cf6-19c9eabba6b0	2026-11-22 14:57:08.343
75546d4d-cdaa-4e6e-b8d4-3cb7b4baa2f7	38ae54d8-ad1a-44d6-b414-710f44c81a7c	765097cf-170c-4e4c-921a-176ab650c618	2026-11-22 14:57:08.345
48ea8d9e-04e4-46f3-8ad2-d7871f0a6453	38ae54d8-ad1a-44d6-b414-710f44c81a7c	593596f6-7f42-443a-8dbf-d381843a6071	2026-11-22 14:57:08.347
b96cabb4-30c6-4b14-a949-5f9e2470450a	38ae54d8-ad1a-44d6-b414-710f44c81a7c	2b80d88b-7f12-4c80-8c6d-56eda58e419d	2026-11-22 14:57:08.349
a558ed80-941f-4b47-9651-9de489899f56	38ae54d8-ad1a-44d6-b414-710f44c81a7c	e63d2146-5e52-4b4f-ba20-e4f486ea0bf2	2026-11-22 14:57:08.351
f8b5b7ec-5922-4f07-a0aa-4051248bd009	38ae54d8-ad1a-44d6-b414-710f44c81a7c	6c60977a-7958-4286-8f5a-c1dcd9b327d9	2026-11-22 14:57:08.352
314979d3-5cab-477c-aaf1-90bc60f7724f	38ae54d8-ad1a-44d6-b414-710f44c81a7c	bf0ab705-afb5-4af0-8453-ee64bc2955e8	2026-11-22 14:57:08.354
b79a6f76-ad3c-4a95-ae13-884a01c77795	38ae54d8-ad1a-44d6-b414-710f44c81a7c	0f274b14-45b1-4f26-b728-1b8acd4215b8	2026-11-22 14:57:08.357
514c239b-1f4f-49d1-a616-dffeeeeddbe2	38ae54d8-ad1a-44d6-b414-710f44c81a7c	4efae7f3-6b4c-4194-944f-882c33906d72	2026-11-22 14:57:08.359
a9136ee9-4db7-44e7-8689-fb1906d9fd69	38ae54d8-ad1a-44d6-b414-710f44c81a7c	bb801315-53fb-41b5-b089-91c9cea73a75	2026-11-22 14:57:08.362
b13363da-d9bc-46e5-98e6-c9e308768747	38ae54d8-ad1a-44d6-b414-710f44c81a7c	43cbe4fc-38d2-4ab3-90be-aee99863bbe6	2026-11-22 14:57:08.363
50112f89-682c-4bd4-842c-112f596a8466	38ae54d8-ad1a-44d6-b414-710f44c81a7c	edbeee93-5037-42cf-a9a1-d19babcd8372	2026-11-22 14:57:08.365
c6bb02c1-7c24-4b76-bb35-602ca7ef8f58	38ae54d8-ad1a-44d6-b414-710f44c81a7c	625dbd52-d7b9-4d4c-b2c8-f756de0e385f	2026-11-22 14:57:08.367
b14e2ce2-a777-4131-962a-feb0f7eef7ad	38ae54d8-ad1a-44d6-b414-710f44c81a7c	d7823281-e055-4239-a2b2-adb7a58bb66f	2026-11-22 14:57:08.37
6c9b7058-3dcf-4e0e-b750-268b67c35ae8	38ae54d8-ad1a-44d6-b414-710f44c81a7c	446ab6ea-968e-49da-a3e8-9f3abcfc55ec	2026-11-22 14:57:08.372
b9d6c2b5-0467-413c-9f95-be87ae7ac68d	38ae54d8-ad1a-44d6-b414-710f44c81a7c	29de90ac-643c-454a-b847-9d3f7be7a55c	2026-11-22 14:57:08.375
ffae12f1-1937-481c-af85-a23e1b976e6b	38ae54d8-ad1a-44d6-b414-710f44c81a7c	f7724e55-dc38-448a-bc15-1b093a19aae1	2026-11-22 14:57:08.377
c8d5ba3b-fe6d-4642-965d-21f6b639bb9c	38ae54d8-ad1a-44d6-b414-710f44c81a7c	96817558-55d2-48cf-8212-56961e29bf71	2026-11-22 14:57:08.38
69fffbe6-02b7-4c9e-bd6f-0a0317dc5a30	38ae54d8-ad1a-44d6-b414-710f44c81a7c	8fd44d07-aa76-4b04-81ba-6ef975cd6a47	2026-11-22 14:57:08.382
88d156f0-07e3-4b4d-a814-c469cc01fe7c	38ae54d8-ad1a-44d6-b414-710f44c81a7c	34231719-5067-4cff-8b81-6a33eab5f3d3	2026-11-22 14:57:08.384
dde0ac3e-f0cd-4f0a-be8a-17a10b8eff9a	38ae54d8-ad1a-44d6-b414-710f44c81a7c	ad08a2ab-61d3-4b55-9d6d-1baa8ca177fe	2026-11-22 14:57:08.385
83e93934-43b2-466b-b93d-e9d99de4efcc	38ae54d8-ad1a-44d6-b414-710f44c81a7c	f3888a17-eff6-4b28-8947-c4da172950d3	2026-11-22 14:57:08.388
0e3e4b29-e90c-4680-821e-836b693f7a84	38ae54d8-ad1a-44d6-b414-710f44c81a7c	2e4124c1-cde1-49d5-a20f-e97e8773462d	2026-11-22 14:57:08.39
420c9564-4dd8-4417-8ca4-f6d011da5d7e	38ae54d8-ad1a-44d6-b414-710f44c81a7c	1708ed71-a656-475f-b82d-a9f16c582b02	2026-11-22 14:57:08.392
9c886e63-a9ba-4673-87c6-9f36b81ff763	38ae54d8-ad1a-44d6-b414-710f44c81a7c	f60b8f20-bf2f-4989-897d-9857b9dc2d60	2026-11-22 14:57:08.394
5ee30e3a-74f7-4d5d-af47-0045c7c60fad	38ae54d8-ad1a-44d6-b414-710f44c81a7c	36e0dfaf-9d8c-4fc5-a4a7-2f807f0fe50e	2026-11-22 14:57:08.396
fdec1113-a309-4da8-98c8-71c4518e260a	38ae54d8-ad1a-44d6-b414-710f44c81a7c	299a3558-4afb-450b-ab5a-2b587b6fff85	2026-11-22 14:57:08.397
fe56ceb7-f314-4cb8-807e-2c6cc8335688	38ae54d8-ad1a-44d6-b414-710f44c81a7c	5da72452-b0d7-4415-b674-50d29adfca31	2026-11-22 14:57:08.399
5ede993e-bcd1-4c61-9982-0a73c206ac58	38ae54d8-ad1a-44d6-b414-710f44c81a7c	72b2f531-bba8-4917-8206-256ea4939bc3	2026-11-22 14:57:08.4
d4925c68-d5ec-4a0f-b708-5adaf43356cb	38ae54d8-ad1a-44d6-b414-710f44c81a7c	55359e39-5477-4a56-9c23-bd5251ede3e7	2026-11-22 14:57:08.401
5768fd0e-d77a-461d-a43c-be7755017ce1	38ae54d8-ad1a-44d6-b414-710f44c81a7c	078cfc5a-6b54-47be-96fa-3db45f16d438	2026-11-22 14:57:08.402
214dd112-c271-46fb-95bd-1de5730f6352	38ae54d8-ad1a-44d6-b414-710f44c81a7c	74f68499-e4b8-41ca-8cb0-a3a3f3f9849b	2026-11-22 14:57:08.404
165248f4-3c74-42ea-b8e2-bc2270ba5b8c	d6e1b1ab-7b80-4430-8f59-dc558bcff945	6716e308-da52-438a-8d77-b677500b547f	2026-11-22 14:57:08.406
15eac4f3-fc26-48de-9d49-7b15d12d384f	d6e1b1ab-7b80-4430-8f59-dc558bcff945	29dcb503-39b8-43db-9a22-bcabfa5ac900	2026-11-22 14:57:08.407
57076d28-6082-4648-99dd-90588cfb80e7	d6e1b1ab-7b80-4430-8f59-dc558bcff945	ecf19a5a-d2ca-43a4-9de7-dd11c10f4d2c	2026-11-22 14:57:08.408
985c9370-062c-4bd7-afc8-20d3c5980d35	d6e1b1ab-7b80-4430-8f59-dc558bcff945	f43929f6-fb1f-47ff-9e6c-ec5d969fc8a2	2026-11-22 14:57:08.409
2a6400a7-9522-4de0-83aa-cbc7e93e91f7	d6e1b1ab-7b80-4430-8f59-dc558bcff945	b6d2ff27-a3b5-4a21-a54e-20304b45ca7e	2026-11-22 14:57:08.41
70570f13-dc03-4283-83ba-907b1198edaf	d6e1b1ab-7b80-4430-8f59-dc558bcff945	05ec03da-e3ad-47b0-b9f5-78ff37c533fd	2026-11-22 14:57:08.412
2341c2ed-d22a-4aac-ab89-b2bce1442031	d6e1b1ab-7b80-4430-8f59-dc558bcff945	89715244-9b46-47e1-a4ff-b8ffb2d1dc14	2026-11-22 14:57:08.412
1dc1a4e1-83b5-44de-a414-39d527a28042	d6e1b1ab-7b80-4430-8f59-dc558bcff945	e7e49e10-92f2-4222-9cd9-58fd15f8771b	2026-11-22 14:57:08.413
fa523d14-c89b-4994-ad9f-61acaed5a294	d6e1b1ab-7b80-4430-8f59-dc558bcff945	aaf23acb-a206-416f-a5ea-13b8cf49bdf1	2026-11-22 14:57:08.415
9a187a21-723c-454a-afb5-bd063bd19fcb	d6e1b1ab-7b80-4430-8f59-dc558bcff945	a271f497-aa37-4d99-9cf6-19c9eabba6b0	2026-11-22 14:57:08.416
e8d90bb6-9e3c-4666-9eae-96081377b9c1	d6e1b1ab-7b80-4430-8f59-dc558bcff945	765097cf-170c-4e4c-921a-176ab650c618	2026-11-22 14:57:08.417
05d008f1-c893-4a71-986e-ff4ece2474a5	d6e1b1ab-7b80-4430-8f59-dc558bcff945	593596f6-7f42-443a-8dbf-d381843a6071	2026-11-22 14:57:08.419
3176435f-eaa9-4374-9d26-1df9b6d5b302	d6e1b1ab-7b80-4430-8f59-dc558bcff945	e63d2146-5e52-4b4f-ba20-e4f486ea0bf2	2026-11-22 14:57:08.421
6490be84-5de0-49b0-b108-162c9d0f35d7	d6e1b1ab-7b80-4430-8f59-dc558bcff945	6c60977a-7958-4286-8f5a-c1dcd9b327d9	2026-11-22 14:57:08.423
9e50911c-b6c5-4355-91fe-7dd30d5d174a	d6e1b1ab-7b80-4430-8f59-dc558bcff945	bf0ab705-afb5-4af0-8453-ee64bc2955e8	2026-11-22 14:57:08.425
385c8e82-e71d-4ce4-8d0b-de244c46eab2	d6e1b1ab-7b80-4430-8f59-dc558bcff945	4efae7f3-6b4c-4194-944f-882c33906d72	2026-11-22 14:57:08.427
e28bb606-8599-43a9-a45f-1f1934f0090e	d6e1b1ab-7b80-4430-8f59-dc558bcff945	bb801315-53fb-41b5-b089-91c9cea73a75	2026-11-22 14:57:08.428
774a676f-0445-4f2e-ac91-b23156597395	d6e1b1ab-7b80-4430-8f59-dc558bcff945	43cbe4fc-38d2-4ab3-90be-aee99863bbe6	2026-11-22 14:57:08.429
5ae932ae-5429-437b-a471-3ca428db4593	d6e1b1ab-7b80-4430-8f59-dc558bcff945	625dbd52-d7b9-4d4c-b2c8-f756de0e385f	2026-11-22 14:57:08.43
4e7c8884-726c-41d0-9d26-3f6e5365a944	d6e1b1ab-7b80-4430-8f59-dc558bcff945	d7823281-e055-4239-a2b2-adb7a58bb66f	2026-11-22 14:57:08.431
2e0b3360-5dcb-4bfd-ab3e-ae1c0a9deac6	d6e1b1ab-7b80-4430-8f59-dc558bcff945	446ab6ea-968e-49da-a3e8-9f3abcfc55ec	2026-11-22 14:57:08.432
cad33f53-a7b4-4e9f-940f-457ddd4ac7bd	d6e1b1ab-7b80-4430-8f59-dc558bcff945	f7724e55-dc38-448a-bc15-1b093a19aae1	2026-11-22 14:57:08.434
f185c033-5087-4387-9bc2-1f129aed0f6c	d6e1b1ab-7b80-4430-8f59-dc558bcff945	96817558-55d2-48cf-8212-56961e29bf71	2026-11-22 14:57:08.436
20e3592a-b9ca-4aed-b009-888d1ba151b5	d6e1b1ab-7b80-4430-8f59-dc558bcff945	8fd44d07-aa76-4b04-81ba-6ef975cd6a47	2026-11-22 14:57:08.437
406eb2f9-9e95-48b6-b6b1-fa21924451c3	d6e1b1ab-7b80-4430-8f59-dc558bcff945	ad08a2ab-61d3-4b55-9d6d-1baa8ca177fe	2026-11-22 14:57:08.439
b09a1ad2-5b5c-4288-9893-e576900e1afe	d6e1b1ab-7b80-4430-8f59-dc558bcff945	f3888a17-eff6-4b28-8947-c4da172950d3	2026-11-22 14:57:08.44
40c22874-50ff-4ba5-871a-dbe5bf457da3	d6e1b1ab-7b80-4430-8f59-dc558bcff945	2e4124c1-cde1-49d5-a20f-e97e8773462d	2026-11-22 14:57:08.441
a1390816-f49c-47ba-a594-6aa33a97ebe4	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	29dcb503-39b8-43db-9a22-bcabfa5ac900	2026-11-22 14:57:08.443
b4ac6641-35a1-4b0c-9776-3db1e96c0627	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	b6d2ff27-a3b5-4a21-a54e-20304b45ca7e	2026-11-22 14:57:08.444
a01f2bcd-e5d4-456e-9327-338d766a7e81	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	e7e49e10-92f2-4222-9cd9-58fd15f8771b	2026-11-22 14:57:08.445
4d2967ac-03b0-47d4-bc7e-40e6167530be	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	765097cf-170c-4e4c-921a-176ab650c618	2026-11-22 14:57:08.446
d54b62e0-5a4b-4fcd-b5cb-2688f61ee475	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	6c60977a-7958-4286-8f5a-c1dcd9b327d9	2026-11-22 14:57:08.447
07b10c31-dc8f-4a2b-ba6e-552ab0d726f6	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	bb801315-53fb-41b5-b089-91c9cea73a75	2026-11-22 14:57:08.448
c6a42be3-e78b-4f33-9be1-c189061cf878	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	d7823281-e055-4239-a2b2-adb7a58bb66f	2026-11-22 14:57:08.45
d431a2ac-9392-4a4b-b54d-d2f27c8e29be	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	96817558-55d2-48cf-8212-56961e29bf71	2026-11-22 14:57:08.451
0c91f316-fd71-4a99-a4fb-a4167a40e07f	e8c824b3-ddf6-4c33-921b-f4fb6be5074e	f3888a17-eff6-4b28-8947-c4da172950d3	2026-11-22 14:57:08.453
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, "isSystem", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
18315ab6-7053-4fb6-8628-502cddc4ccbb	OWNER	Full system owner	t	2026-11-22 14:57:08.09	2026-11-22 14:57:08.09	\N	\N	\N	ACTIVE	1
38ae54d8-ad1a-44d6-b414-710f44c81a7c	ADMIN	System administrator	t	2026-11-22 14:57:08.093	2026-11-22 14:57:08.093	\N	\N	\N	ACTIVE	1
d6e1b1ab-7b80-4430-8f59-dc558bcff945	MANAGER	Department manager	t	2026-11-22 14:57:08.095	2026-11-22 14:57:08.095	\N	\N	\N	ACTIVE	1
e8c824b3-ddf6-4c33-921b-f4fb6be5074e	STAFF	Regular staff member	t	2026-11-22 14:57:08.097	2026-11-22 14:57:08.097	\N	\N	\N	ACTIVE	1
43c34d0d-0839-4171-8f91-d701186fad55	MEMBER	Basic member	t	2026-11-22 14:57:08.099	2026-11-22 14:57:08.099	\N	\N	\N	ACTIVE	1
\.


--
-- Data for Name: sales_dispatch_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_dispatch_items (id, "dispatchId", "itemId", quantity, "unitCost", "totalCost", "soItemId", "createdAt") FROM stdin;
\.


--
-- Data for Name: sales_dispatches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_dispatches (id, "companyId", "dispatchNumber", "customerId", "warehouseId", "soId", "dispatchDate", status, "voucherId", "totalCost", notes, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: sales_invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_invoice_items (id, "invoiceId", "itemId", description, quantity, "unitPrice", "taxPct", "taxAmount", "lineTotal", "createdAt") FROM stdin;
\.


--
-- Data for Name: sales_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_invoices (id, "companyId", "invoiceNumber", "customerId", "soId", "dispatchId", "invoiceDate", "dueDate", status, "voucherId", subtotal, "taxAmount", "totalAmount", "paidAmount", "withheldAmount", "outstandingAmount", "customerTaxId", "billingAddress", notes, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: sales_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_order_items (id, "soId", "itemId", description, quantity, "unitPrice", "discountPct", "taxPct", "totalPrice", "deliveredQty", "createdAt") FROM stdin;
\.


--
-- Data for Name: sales_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_orders (id, "companyId", "soNumber", "customerId", "orderDate", "expectedDelivery", "paymentTerms", "shippingCost", "discountAmount", "taxAmount", "grandTotal", notes, status, "approvedBy", "approvedAt", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, "tokenHash", "userId", "expiresAt", "revokedAt", "lastActivity", "createdAt", "updatedAt") FROM stdin;
d65742d6-2a93-4b0a-b20a-86f61c117c3f	0af93e9e0f6fb101bd2861451ed3d8b6b82eeac9f6dbfc772bbb162848c343f2	5c649ad8-9b63-4e61-b0aa-055970458052	2026-11-23 14:57:08.536	\N	2026-11-22 15:15:15.39	2026-11-22 14:57:08.538	2026-11-22 15:15:15.391
\.


--
-- Data for Name: statutory_obligations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statutory_obligations (id, "companyId", "obligationNumber", head, authority, "registrationNumber", "taxPeriod", "dueAmount", "paidAmount", "outstandingAmount", "dueDate", status, "assessmentReference", "challanNumber", psid, "voucherId", notes, "createdAt", "updatedAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: statutory_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statutory_payments (id, "companyId", "paymentNumber", "obligationId", "paymentDate", amount, "paymentMethod", "cprNumber", psid, "bankReference", "evidenceUrl", "evidenceStatus", "voucherId", status, notes, "createdAt", "updatedAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: stock_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_ledger (id, "companyId", "itemId", "warehouseId", "transactionType", "referenceId", "referenceType", "qtyBefore", "qtyChange", "qtyAfter", "costBefore", "costChange", "costAfter", notes, "createdBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: supplier_bill_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_bill_items (id, "billId", "grnId", "grnItemId", "poItemId", "itemId", "billedQty", "unitPrice", "taxAmount", "lineTotal", "createdAt") FROM stdin;
\.


--
-- Data for Name: supplier_bills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_bills (id, "companyId", "billNumber", "vendorId", "supplierInvoiceNumber", "supplierInvoiceDate", "billDate", "dueDate", status, "voucherId", subtotal, "taxAmount", "totalAmount", "paidAmount", notes, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units (id, "companyId", name, code, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, "userId", "roleId", "createdAt") FROM stdin;
85cd9033-b3bc-4c31-bb65-84427f9224e4	5c649ad8-9b63-4e61-b0aa-055970458052	18315ab6-7053-4fb6-8628-502cddc4ccbb	2026-11-22 14:57:08.454
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, "companyId", role, email, password, "employeeId", "firebaseUid", "isEmailVerified", status, "lastLoginAt", "loginCount", "refreshToken", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
5c649ad8-9b63-4e61-b0aa-055970458052	a98c125d-3be9-46dc-873f-bc32f59df19e	OWNER	aamish@digitalerena.com	$argon2id$v=19$m=19456,t=2,p=1$00z+bVKUYAQxxdgft6+LJg$o7j2YSLNE627vFhYPiNDt3ShgpbvK6Xi6WzZB3O1nPM	\N	\N	t	ACTIVE	\N	0	\N	2026-11-22 14:57:08.057	2026-11-22 14:57:08.057	\N	\N	\N	1
\.


--
-- Data for Name: vendor_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_items (id, "companyId", "vendorId", "itemId", "preferredSupplier", "leadTimeDays", "minimumOrderQuantity", "unitPrice", remarks, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: vendor_quotation_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_quotation_items (id, "quotationId", "itemId", description, quantity, "unitPrice", "discountPct", "taxPct", "totalPrice", "createdAt") FROM stdin;
\.


--
-- Data for Name: vendor_quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_quotations (id, "companyId", "quotationNumber", "vendorId", "demandNoteId", "quotationDate", "deliveryTime", warranty, notes, status, "totalAmount", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", version) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, "companyId", "vendorCode", name, "contactPerson", email, phone, address, city, state, country, "bankName", "bankAccount", "bankIfsc", "paymentTerms", "taxNumber", rating, "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Data for Name: vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vouchers (id, "companyId", "branchId", "voucherNumber", "voucherType", "businessDate", status, "periodId", reference, notes, "createdBy", "createdAt", "updatedAt", "reversalOfVoucherId") FROM stdin;
\.


--
-- Data for Name: wage_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wage_lines (id, "wageRunId", "employeeId", "daysWorked", "dailyRate", "grossAmount", deductions, "netAmount", "createdAt") FROM stdin;
\.


--
-- Data for Name: wage_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wage_runs (id, "companyId", "runNumber", "periodMonth", "periodYear", "runType", status, "totalAmount", "voucherId", "disbursementVoucherId", "disbursedAt", notes, "createdAt", "updatedAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: warehouse_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_stock (id, "companyId", "warehouseId", "itemId", quantity, "averageCost", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouses (id, "companyId", "branchId", name, code, address, city, state, country, "isActive", "createdAt", "updatedAt", "deletedAt", "createdBy", "updatedBy", status, version) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: accounting_periods accounting_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backups backups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_pkey PRIMARY KEY (id);


--
-- Name: bill_of_materials bill_of_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_of_materials
    ADD CONSTRAINT bill_of_materials_pkey PRIMARY KEY (id);


--
-- Name: bom_materials bom_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bom_materials
    ADD CONSTRAINT bom_materials_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: customer_receipts customer_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_receipts
    ADD CONSTRAINT customer_receipts_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: demand_note_items demand_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_note_items
    ADD CONSTRAINT demand_note_items_pkey PRIMARY KEY (id);


--
-- Name: demand_notes demand_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_notes
    ADD CONSTRAINT demand_notes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: fifo_allocations fifo_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_allocations
    ADD CONSTRAINT fifo_allocations_pkey PRIMARY KEY (id);


--
-- Name: fifo_layers fifo_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_layers
    ADD CONSTRAINT fifo_layers_pkey PRIMARY KEY (id);


--
-- Name: goods_receiving_items goods_receiving_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_items
    ADD CONSTRAINT goods_receiving_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receiving_notes goods_receiving_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_notes
    ADD CONSTRAINT goods_receiving_notes_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_items journal_entry_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entry_items
    ADD CONSTRAINT journal_entry_items_pkey PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: material_consumptions material_consumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_consumptions
    ADD CONSTRAINT material_consumptions_pkey PRIMARY KEY (id);


--
-- Name: material_issue_items material_issue_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issue_items
    ADD CONSTRAINT material_issue_items_pkey PRIMARY KEY (id);


--
-- Name: material_issues material_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT material_issues_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pay_slip_items pay_slip_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slip_items
    ADD CONSTRAINT pay_slip_items_pkey PRIMARY KEY (id);


--
-- Name: pay_slips pay_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slips
    ADD CONSTRAINT pay_slips_pkey PRIMARY KEY (id);


--
-- Name: payheads payheads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payheads
    ADD CONSTRAINT payheads_pkey PRIMARY KEY (id);


--
-- Name: payroll_periods payroll_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: production_orders production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_items purchase_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: quality_checks quality_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_pkey PRIMARY KEY (id);


--
-- Name: receipt_allocations receipt_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_dispatch_items sales_dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatch_items
    ADD CONSTRAINT sales_dispatch_items_pkey PRIMARY KEY (id);


--
-- Name: sales_dispatches sales_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatches
    ADD CONSTRAINT sales_dispatches_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: statutory_obligations statutory_obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statutory_obligations
    ADD CONSTRAINT statutory_obligations_pkey PRIMARY KEY (id);


--
-- Name: statutory_payments statutory_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statutory_payments
    ADD CONSTRAINT statutory_payments_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: supplier_bill_items supplier_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bill_items
    ADD CONSTRAINT supplier_bill_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_bills supplier_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bills
    ADD CONSTRAINT supplier_bills_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_items vendor_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_items
    ADD CONSTRAINT vendor_items_pkey PRIMARY KEY (id);


--
-- Name: vendor_quotation_items vendor_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_quotation_items
    ADD CONSTRAINT vendor_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: vendor_quotations vendor_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT vendor_quotations_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: wage_lines wage_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wage_lines
    ADD CONSTRAINT wage_lines_pkey PRIMARY KEY (id);


--
-- Name: wage_runs wage_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wage_runs
    ADD CONSTRAINT wage_runs_pkey PRIMARY KEY (id);


--
-- Name: warehouse_stock warehouse_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: accounting_periods_companyId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "accounting_periods_companyId_name_key" ON public.accounting_periods USING btree ("companyId", name);


--
-- Name: accounting_periods_companyId_startDate_endDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "accounting_periods_companyId_startDate_endDate_idx" ON public.accounting_periods USING btree ("companyId", "startDate", "endDate");


--
-- Name: accounts_companyId_accountCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "accounts_companyId_accountCode_key" ON public.accounts USING btree ("companyId", "accountCode");


--
-- Name: accounts_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "accounts_companyId_idx" ON public.accounts USING btree ("companyId");


--
-- Name: attendance_employeeId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "attendance_employeeId_date_key" ON public.attendance USING btree ("employeeId", date);


--
-- Name: audit_logs_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_companyId_idx" ON public.audit_logs USING btree ("companyId");


--
-- Name: bill_of_materials_companyId_bomNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "bill_of_materials_companyId_bomNumber_key" ON public.bill_of_materials USING btree ("companyId", "bomNumber");


--
-- Name: bill_of_materials_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "bill_of_materials_companyId_idx" ON public.bill_of_materials USING btree ("companyId");


--
-- Name: bom_materials_bomId_itemId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "bom_materials_bomId_itemId_key" ON public.bom_materials USING btree ("bomId", "itemId");


--
-- Name: branches_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "branches_companyId_code_key" ON public.branches USING btree ("companyId", code);


--
-- Name: categories_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "categories_companyId_code_key" ON public.categories USING btree ("companyId", code);


--
-- Name: categories_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "categories_companyId_idx" ON public.categories USING btree ("companyId");


--
-- Name: customer_receipts_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "customer_receipts_companyId_idx" ON public.customer_receipts USING btree ("companyId");


--
-- Name: customer_receipts_companyId_receiptNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "customer_receipts_companyId_receiptNumber_key" ON public.customer_receipts USING btree ("companyId", "receiptNumber");


--
-- Name: customers_companyId_customerCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "customers_companyId_customerCode_key" ON public.customers USING btree ("companyId", "customerCode");


--
-- Name: customers_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "customers_companyId_idx" ON public.customers USING btree ("companyId");


--
-- Name: demand_notes_companyId_demandNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "demand_notes_companyId_demandNumber_key" ON public.demand_notes USING btree ("companyId", "demandNumber");


--
-- Name: demand_notes_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "demand_notes_companyId_idx" ON public.demand_notes USING btree ("companyId");


--
-- Name: departments_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "departments_companyId_idx" ON public.departments USING btree ("companyId");


--
-- Name: designations_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "designations_companyId_code_key" ON public.designations USING btree ("companyId", code);


--
-- Name: designations_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "designations_companyId_idx" ON public.designations USING btree ("companyId");


--
-- Name: employees_companyId_employeeCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "employees_companyId_employeeCode_key" ON public.employees USING btree ("companyId", "employeeCode");


--
-- Name: employees_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "employees_companyId_idx" ON public.employees USING btree ("companyId");


--
-- Name: employees_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employees_email_key ON public.employees USING btree (email);


--
-- Name: fifo_allocations_companyId_layerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fifo_allocations_companyId_layerId_idx" ON public.fifo_allocations USING btree ("companyId", "layerId");


--
-- Name: fifo_layers_companyId_warehouseId_itemId_receiptDate_sequen_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fifo_layers_companyId_warehouseId_itemId_receiptDate_sequen_idx" ON public.fifo_layers USING btree ("companyId", "warehouseId", "itemId", "receiptDate", sequence);


--
-- Name: fifo_layers_companyId_warehouseId_itemId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fifo_layers_companyId_warehouseId_itemId_status_idx" ON public.fifo_layers USING btree ("companyId", "warehouseId", "itemId", status);


--
-- Name: goods_receiving_notes_companyId_grnNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "goods_receiving_notes_companyId_grnNumber_key" ON public.goods_receiving_notes USING btree ("companyId", "grnNumber");


--
-- Name: goods_receiving_notes_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "goods_receiving_notes_companyId_idx" ON public.goods_receiving_notes USING btree ("companyId");


--
-- Name: idempotency_keys_companyId_action_requestKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idempotency_keys_companyId_action_requestKey_key" ON public.idempotency_keys USING btree ("companyId", action, "requestKey");


--
-- Name: idempotency_keys_companyId_requestKey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idempotency_keys_companyId_requestKey_idx" ON public.idempotency_keys USING btree ("companyId", "requestKey");


--
-- Name: items_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "items_companyId_idx" ON public.items USING btree ("companyId");


--
-- Name: items_companyId_itemCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "items_companyId_itemCode_key" ON public.items USING btree ("companyId", "itemCode");


--
-- Name: journal_entries_companyId_entryNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "journal_entries_companyId_entryNumber_key" ON public.journal_entries USING btree ("companyId", "entryNumber");


--
-- Name: journal_entries_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "journal_entries_companyId_idx" ON public.journal_entries USING btree ("companyId");


--
-- Name: journal_entries_voucherId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "journal_entries_voucherId_key" ON public.journal_entries USING btree ("voucherId");


--
-- Name: material_issues_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "material_issues_companyId_idx" ON public.material_issues USING btree ("companyId");


--
-- Name: material_issues_companyId_issueNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "material_issues_companyId_issueNumber_key" ON public.material_issues USING btree ("companyId", "issueNumber");


--
-- Name: notifications_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_companyId_idx" ON public.notifications USING btree ("companyId");


--
-- Name: pay_slip_items_paySlipId_payheadId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "pay_slip_items_paySlipId_payheadId_key" ON public.pay_slip_items USING btree ("paySlipId", "payheadId");


--
-- Name: payheads_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "payheads_companyId_code_key" ON public.payheads USING btree ("companyId", code);


--
-- Name: payheads_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payheads_companyId_idx" ON public.payheads USING btree ("companyId");


--
-- Name: payheads_companyId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "payheads_companyId_name_key" ON public.payheads USING btree ("companyId", name);


--
-- Name: payroll_periods_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payroll_periods_companyId_idx" ON public.payroll_periods USING btree ("companyId");


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: permissions_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name);


--
-- Name: production_orders_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "production_orders_companyId_idx" ON public.production_orders USING btree ("companyId");


--
-- Name: production_orders_companyId_productionNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "production_orders_companyId_productionNumber_key" ON public.production_orders USING btree ("companyId", "productionNumber");


--
-- Name: purchase_orders_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "purchase_orders_companyId_idx" ON public.purchase_orders USING btree ("companyId");


--
-- Name: purchase_orders_companyId_poNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "purchase_orders_companyId_poNumber_key" ON public.purchase_orders USING btree ("companyId", "poNumber");


--
-- Name: purchase_returns_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "purchase_returns_companyId_idx" ON public.purchase_returns USING btree ("companyId");


--
-- Name: purchase_returns_companyId_returnNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "purchase_returns_companyId_returnNumber_key" ON public.purchase_returns USING btree ("companyId", "returnNumber");


--
-- Name: receipt_allocations_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "receipt_allocations_companyId_idx" ON public.receipt_allocations USING btree ("companyId");


--
-- Name: role_permissions_roleId_permissionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON public.role_permissions USING btree ("roleId", "permissionId");


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: sales_dispatches_companyId_dispatchNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sales_dispatches_companyId_dispatchNumber_key" ON public.sales_dispatches USING btree ("companyId", "dispatchNumber");


--
-- Name: sales_dispatches_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_dispatches_companyId_idx" ON public.sales_dispatches USING btree ("companyId");


--
-- Name: sales_invoices_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_invoices_companyId_idx" ON public.sales_invoices USING btree ("companyId");


--
-- Name: sales_invoices_companyId_invoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sales_invoices_companyId_invoiceNumber_key" ON public.sales_invoices USING btree ("companyId", "invoiceNumber");


--
-- Name: sales_orders_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sales_orders_companyId_idx" ON public.sales_orders USING btree ("companyId");


--
-- Name: sales_orders_companyId_soNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sales_orders_companyId_soNumber_key" ON public.sales_orders USING btree ("companyId", "soNumber");


--
-- Name: sessions_tokenHash_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sessions_tokenHash_idx" ON public.sessions USING btree ("tokenHash");


--
-- Name: sessions_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sessions_tokenHash_key" ON public.sessions USING btree ("tokenHash");


--
-- Name: sessions_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sessions_userId_idx" ON public.sessions USING btree ("userId");


--
-- Name: statutory_obligations_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "statutory_obligations_companyId_idx" ON public.statutory_obligations USING btree ("companyId");


--
-- Name: statutory_obligations_companyId_obligationNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "statutory_obligations_companyId_obligationNumber_key" ON public.statutory_obligations USING btree ("companyId", "obligationNumber");


--
-- Name: statutory_payments_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "statutory_payments_companyId_idx" ON public.statutory_payments USING btree ("companyId");


--
-- Name: statutory_payments_companyId_paymentNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "statutory_payments_companyId_paymentNumber_key" ON public.statutory_payments USING btree ("companyId", "paymentNumber");


--
-- Name: stock_ledger_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stock_ledger_companyId_idx" ON public.stock_ledger USING btree ("companyId");


--
-- Name: stock_ledger_itemId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stock_ledger_itemId_idx" ON public.stock_ledger USING btree ("itemId");


--
-- Name: stock_ledger_referenceType_referenceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "stock_ledger_referenceType_referenceId_idx" ON public.stock_ledger USING btree ("referenceType", "referenceId");


--
-- Name: supplier_bills_companyId_billNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "supplier_bills_companyId_billNumber_key" ON public.supplier_bills USING btree ("companyId", "billNumber");


--
-- Name: supplier_bills_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "supplier_bills_companyId_idx" ON public.supplier_bills USING btree ("companyId");


--
-- Name: supplier_bills_companyId_vendorId_supplierInvoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "supplier_bills_companyId_vendorId_supplierInvoiceNumber_key" ON public.supplier_bills USING btree ("companyId", "vendorId", "supplierInvoiceNumber");


--
-- Name: units_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "units_companyId_code_key" ON public.units USING btree ("companyId", code);


--
-- Name: units_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "units_companyId_idx" ON public.units USING btree ("companyId");


--
-- Name: user_roles_userId_roleId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON public.user_roles USING btree ("userId", "roleId");


--
-- Name: users_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "users_companyId_idx" ON public.users USING btree ("companyId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_employeeId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "users_employeeId_key" ON public.users USING btree ("employeeId");


--
-- Name: vendor_items_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "vendor_items_companyId_idx" ON public.vendor_items USING btree ("companyId");


--
-- Name: vendor_items_itemId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "vendor_items_itemId_idx" ON public.vendor_items USING btree ("itemId");


--
-- Name: vendor_items_vendorId_itemId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "vendor_items_vendorId_itemId_key" ON public.vendor_items USING btree ("vendorId", "itemId");


--
-- Name: vendor_quotations_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "vendor_quotations_companyId_idx" ON public.vendor_quotations USING btree ("companyId");


--
-- Name: vendor_quotations_companyId_quotationNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "vendor_quotations_companyId_quotationNumber_key" ON public.vendor_quotations USING btree ("companyId", "quotationNumber");


--
-- Name: vendors_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "vendors_companyId_idx" ON public.vendors USING btree ("companyId");


--
-- Name: vendors_companyId_vendorCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "vendors_companyId_vendorCode_key" ON public.vendors USING btree ("companyId", "vendorCode");


--
-- Name: vouchers_companyId_voucherNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "vouchers_companyId_voucherNumber_key" ON public.vouchers USING btree ("companyId", "voucherNumber");


--
-- Name: vouchers_companyId_voucherType_businessDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "vouchers_companyId_voucherType_businessDate_idx" ON public.vouchers USING btree ("companyId", "voucherType", "businessDate");


--
-- Name: wage_runs_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "wage_runs_companyId_idx" ON public.wage_runs USING btree ("companyId");


--
-- Name: wage_runs_companyId_periodYear_periodMonth_runType_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "wage_runs_companyId_periodYear_periodMonth_runType_key" ON public.wage_runs USING btree ("companyId", "periodYear", "periodMonth", "runType");


--
-- Name: wage_runs_companyId_runNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "wage_runs_companyId_runNumber_key" ON public.wage_runs USING btree ("companyId", "runNumber");


--
-- Name: warehouse_stock_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "warehouse_stock_companyId_idx" ON public.warehouse_stock USING btree ("companyId");


--
-- Name: warehouse_stock_warehouseId_itemId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "warehouse_stock_warehouseId_itemId_key" ON public.warehouse_stock USING btree ("warehouseId", "itemId");


--
-- Name: warehouses_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "warehouses_companyId_code_key" ON public.warehouses USING btree ("companyId", code);


--
-- Name: warehouses_companyId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "warehouses_companyId_idx" ON public.warehouses USING btree ("companyId");


--
-- Name: accounting_periods accounting_periods_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT "accounting_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: accounts accounts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: accounts accounts_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attendance attendance_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bill_of_materials bill_of_materials_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_of_materials
    ADD CONSTRAINT "bill_of_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bill_of_materials bill_of_materials_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_of_materials
    ADD CONSTRAINT "bill_of_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bom_materials bom_materials_bomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bom_materials
    ADD CONSTRAINT "bom_materials_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES public.bill_of_materials(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bom_materials bom_materials_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bom_materials
    ADD CONSTRAINT "bom_materials_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: branches branches_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT "branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: categories categories_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_receipts customer_receipts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_receipts
    ADD CONSTRAINT "customer_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_receipts customer_receipts_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_receipts
    ADD CONSTRAINT "customer_receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customers customers_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: demand_note_items demand_note_items_demandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_note_items
    ADD CONSTRAINT "demand_note_items_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES public.demand_notes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: demand_notes demand_notes_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_notes
    ADD CONSTRAINT "demand_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: departments departments_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: departments departments_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: designations designations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT "designations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees employees_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employees employees_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: employees employees_designationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "employees_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES public.designations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: fifo_allocations fifo_allocations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_allocations
    ADD CONSTRAINT "fifo_allocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fifo_allocations fifo_allocations_layerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_allocations
    ADD CONSTRAINT "fifo_allocations_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES public.fifo_layers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fifo_layers fifo_layers_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_layers
    ADD CONSTRAINT "fifo_layers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fifo_layers fifo_layers_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_layers
    ADD CONSTRAINT "fifo_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fifo_layers fifo_layers_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fifo_layers
    ADD CONSTRAINT "fifo_layers_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: goods_receiving_items goods_receiving_items_grnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_items
    ADD CONSTRAINT "goods_receiving_items_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES public.goods_receiving_notes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: goods_receiving_items goods_receiving_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_items
    ADD CONSTRAINT "goods_receiving_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: goods_receiving_notes goods_receiving_notes_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_notes
    ADD CONSTRAINT "goods_receiving_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: goods_receiving_notes goods_receiving_notes_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_notes
    ADD CONSTRAINT "goods_receiving_notes_poId_fkey" FOREIGN KEY ("poId") REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: goods_receiving_notes goods_receiving_notes_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receiving_notes
    ADD CONSTRAINT "goods_receiving_notes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: idempotency_keys idempotency_keys_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT "idempotency_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: items items_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: items items_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: items items_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: journal_entries journal_entries_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_entries journal_entries_periodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES public.accounting_periods(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: journal_entries journal_entries_voucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "journal_entries_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES public.vouchers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: journal_entry_items journal_entry_items_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entry_items
    ADD CONSTRAINT "journal_entry_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: journal_entry_items journal_entry_items_journalEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entry_items
    ADD CONSTRAINT "journal_entry_items_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES public.journal_entries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: leaves leaves_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: material_consumptions material_consumptions_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_consumptions
    ADD CONSTRAINT "material_consumptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: material_consumptions material_consumptions_productionOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_consumptions
    ADD CONSTRAINT "material_consumptions_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES public.production_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: material_issue_items material_issue_items_demandNoteItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issue_items
    ADD CONSTRAINT "material_issue_items_demandNoteItemId_fkey" FOREIGN KEY ("demandNoteItemId") REFERENCES public.demand_note_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: material_issue_items material_issue_items_issueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issue_items
    ADD CONSTRAINT "material_issue_items_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES public.material_issues(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: material_issue_items material_issue_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issue_items
    ADD CONSTRAINT "material_issue_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: material_issues material_issues_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT "material_issues_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: material_issues material_issues_demandNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT "material_issues_demandNoteId_fkey" FOREIGN KEY ("demandNoteId") REFERENCES public.demand_notes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: material_issues material_issues_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_issues
    ADD CONSTRAINT "material_issues_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pay_slip_items pay_slip_items_paySlipId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slip_items
    ADD CONSTRAINT "pay_slip_items_paySlipId_fkey" FOREIGN KEY ("paySlipId") REFERENCES public.pay_slips(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pay_slip_items pay_slip_items_payheadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slip_items
    ADD CONSTRAINT "pay_slip_items_payheadId_fkey" FOREIGN KEY ("payheadId") REFERENCES public.payheads(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pay_slips pay_slips_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slips
    ADD CONSTRAINT "pay_slips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pay_slips pay_slips_periodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_slips
    ADD CONSTRAINT "pay_slips_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES public.payroll_periods(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payheads payheads_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payheads
    ADD CONSTRAINT "payheads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payroll_periods payroll_periods_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT "payroll_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_orders production_orders_bomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES public.bill_of_materials(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: production_orders production_orders_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_orders production_orders_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT "production_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_order_items purchase_order_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "purchase_order_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES public.purchase_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_orders purchase_orders_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_return_items purchase_return_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT "purchase_return_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_return_items purchase_return_items_returnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT "purchase_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES public.purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_returns purchase_returns_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_returns purchase_returns_grnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES public.goods_receiving_notes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_returns purchase_returns_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_returns purchase_returns_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT "purchase_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quality_checks quality_checks_productionOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT "quality_checks_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES public.production_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receipt_allocations receipt_allocations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT "receipt_allocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: receipt_allocations receipt_allocations_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT "receipt_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.sales_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: receipt_allocations receipt_allocations_receiptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT "receipt_allocations_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES public.customer_receipts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_dispatch_items sales_dispatch_items_dispatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatch_items
    ADD CONSTRAINT "sales_dispatch_items_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES public.sales_dispatches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_dispatch_items sales_dispatch_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatch_items
    ADD CONSTRAINT "sales_dispatch_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_dispatches sales_dispatches_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatches
    ADD CONSTRAINT "sales_dispatches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_dispatches sales_dispatches_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatches
    ADD CONSTRAINT "sales_dispatches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_dispatches sales_dispatches_soId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatches
    ADD CONSTRAINT "sales_dispatches_soId_fkey" FOREIGN KEY ("soId") REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_dispatches sales_dispatches_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_dispatches
    ADD CONSTRAINT "sales_dispatches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_invoice_items sales_invoice_items_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT "sales_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.sales_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT "sales_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_invoices sales_invoices_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT "sales_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_invoices sales_invoices_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT "sales_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_invoices sales_invoices_dispatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT "sales_invoices_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES public.sales_dispatches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_invoices sales_invoices_soId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT "sales_invoices_soId_fkey" FOREIGN KEY ("soId") REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT "sales_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_soId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT "sales_order_items_soId_fkey" FOREIGN KEY ("soId") REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_orders sales_orders_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT "sales_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_orders sales_orders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: statutory_obligations statutory_obligations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statutory_obligations
    ADD CONSTRAINT "statutory_obligations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: statutory_payments statutory_payments_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statutory_payments
    ADD CONSTRAINT "statutory_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: statutory_payments statutory_payments_obligationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statutory_payments
    ADD CONSTRAINT "statutory_payments_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES public.statutory_obligations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_ledger stock_ledger_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "stock_ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_ledger stock_ledger_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "stock_ledger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_bill_items supplier_bill_items_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bill_items
    ADD CONSTRAINT "supplier_bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES public.supplier_bills(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_bill_items supplier_bill_items_grnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bill_items
    ADD CONSTRAINT "supplier_bill_items_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES public.goods_receiving_notes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_bill_items supplier_bill_items_grnItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bill_items
    ADD CONSTRAINT "supplier_bill_items_grnItemId_fkey" FOREIGN KEY ("grnItemId") REFERENCES public.goods_receiving_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_bill_items supplier_bill_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bill_items
    ADD CONSTRAINT "supplier_bill_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_bills supplier_bills_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bills
    ADD CONSTRAINT "supplier_bills_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_bills supplier_bills_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_bills
    ADD CONSTRAINT "supplier_bills_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: units units_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: vendor_items vendor_items_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_items
    ADD CONSTRAINT "vendor_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_items vendor_items_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_items
    ADD CONSTRAINT "vendor_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_items vendor_items_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_items
    ADD CONSTRAINT "vendor_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_quotation_items vendor_quotation_items_quotationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_quotation_items
    ADD CONSTRAINT "vendor_quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES public.vendor_quotations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_quotations vendor_quotations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT "vendor_quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_quotations vendor_quotations_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT "vendor_quotations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendors vendors_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT "vendors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vouchers vouchers_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vouchers vouchers_periodId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT "vouchers_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES public.accounting_periods(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: vouchers vouchers_reversalOfVoucherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT "vouchers_reversalOfVoucherId_fkey" FOREIGN KEY ("reversalOfVoucherId") REFERENCES public.vouchers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: wage_lines wage_lines_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wage_lines
    ADD CONSTRAINT "wage_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: wage_lines wage_lines_wageRunId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wage_lines
    ADD CONSTRAINT "wage_lines_wageRunId_fkey" FOREIGN KEY ("wageRunId") REFERENCES public.wage_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wage_runs wage_runs_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wage_runs
    ADD CONSTRAINT "wage_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warehouse_stock warehouse_stock_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT "warehouse_stock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warehouse_stock warehouse_stock_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT "warehouse_stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warehouse_stock warehouse_stock_warehouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT "warehouse_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warehouses warehouses_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: warehouses warehouses_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO erp_app;


--
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public._prisma_migrations TO erp_app;


--
-- Name: TABLE accounting_periods; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.accounting_periods TO erp_app;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.accounts TO erp_app;


--
-- Name: TABLE attendance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.attendance TO erp_app;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_logs TO erp_app;


--
-- Name: TABLE backups; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.backups TO erp_app;


--
-- Name: TABLE bill_of_materials; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bill_of_materials TO erp_app;


--
-- Name: TABLE bom_materials; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bom_materials TO erp_app;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.branches TO erp_app;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.categories TO erp_app;


--
-- Name: TABLE companies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.companies TO erp_app;


--
-- Name: TABLE customer_receipts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.customer_receipts TO erp_app;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.customers TO erp_app;


--
-- Name: TABLE demand_note_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.demand_note_items TO erp_app;


--
-- Name: TABLE demand_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.demand_notes TO erp_app;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.departments TO erp_app;


--
-- Name: TABLE designations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.designations TO erp_app;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.employees TO erp_app;


--
-- Name: TABLE fifo_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.fifo_allocations TO erp_app;


--
-- Name: TABLE fifo_layers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.fifo_layers TO erp_app;


--
-- Name: TABLE goods_receiving_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.goods_receiving_items TO erp_app;


--
-- Name: TABLE goods_receiving_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.goods_receiving_notes TO erp_app;


--
-- Name: TABLE idempotency_keys; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.idempotency_keys TO erp_app;


--
-- Name: TABLE items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.items TO erp_app;


--
-- Name: TABLE journal_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.journal_entries TO erp_app;


--
-- Name: TABLE journal_entry_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.journal_entry_items TO erp_app;


--
-- Name: TABLE leaves; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.leaves TO erp_app;


--
-- Name: TABLE material_consumptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.material_consumptions TO erp_app;


--
-- Name: TABLE material_issue_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.material_issue_items TO erp_app;


--
-- Name: TABLE material_issues; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.material_issues TO erp_app;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notifications TO erp_app;


--
-- Name: TABLE pay_slip_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pay_slip_items TO erp_app;


--
-- Name: TABLE pay_slips; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pay_slips TO erp_app;


--
-- Name: TABLE payheads; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payheads TO erp_app;


--
-- Name: TABLE payroll_periods; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payroll_periods TO erp_app;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permissions TO erp_app;


--
-- Name: TABLE production_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.production_orders TO erp_app;


--
-- Name: TABLE purchase_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_order_items TO erp_app;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_orders TO erp_app;


--
-- Name: TABLE purchase_return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_return_items TO erp_app;


--
-- Name: TABLE purchase_returns; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchase_returns TO erp_app;


--
-- Name: TABLE quality_checks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.quality_checks TO erp_app;


--
-- Name: TABLE receipt_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.receipt_allocations TO erp_app;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO erp_app;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO erp_app;


--
-- Name: TABLE sales_dispatch_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_dispatch_items TO erp_app;


--
-- Name: TABLE sales_dispatches; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_dispatches TO erp_app;


--
-- Name: TABLE sales_invoice_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_invoice_items TO erp_app;


--
-- Name: TABLE sales_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_invoices TO erp_app;


--
-- Name: TABLE sales_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_order_items TO erp_app;


--
-- Name: TABLE sales_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_orders TO erp_app;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sessions TO erp_app;


--
-- Name: TABLE statutory_obligations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.statutory_obligations TO erp_app;


--
-- Name: TABLE statutory_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.statutory_payments TO erp_app;


--
-- Name: TABLE stock_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_ledger TO erp_app;


--
-- Name: TABLE supplier_bill_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.supplier_bill_items TO erp_app;


--
-- Name: TABLE supplier_bills; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.supplier_bills TO erp_app;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.units TO erp_app;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_roles TO erp_app;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO erp_app;


--
-- Name: TABLE vendor_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vendor_items TO erp_app;


--
-- Name: TABLE vendor_quotation_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vendor_quotation_items TO erp_app;


--
-- Name: TABLE vendor_quotations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vendor_quotations TO erp_app;


--
-- Name: TABLE vendors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vendors TO erp_app;


--
-- Name: TABLE vouchers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vouchers TO erp_app;


--
-- Name: TABLE wage_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.wage_lines TO erp_app;


--
-- Name: TABLE wage_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.wage_runs TO erp_app;


--
-- Name: TABLE warehouse_stock; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.warehouse_stock TO erp_app;


--
-- Name: TABLE warehouses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.warehouses TO erp_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO erp_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO erp_app;


--
-- PostgreSQL database dump complete
--

\unrestrict rVZGHC4tanl0ldAjezi7I2kS3ZTcOR67WYro0nlCf2gs71jpzdBT8sX5jH7omCI

