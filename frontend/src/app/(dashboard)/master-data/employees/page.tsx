"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";
import { api } from "@/lib/api/client";

interface RefOption {
  id: string;
  name: string;
  code?: string;
}

export default function EmployeesPage() {
  const [departments, setDepartments] = useState<RefOption[]>([]);
  const [designations, setDesignations] = useState<RefOption[]>([]);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [deptRes, desigRes] = await Promise.allSettled([
          api.getWithMeta<RefOption[]>("/master-data/department?limit=500"),
          api.getWithMeta<RefOption[]>("/master-data/designation?limit=500"),
        ]);
        if (deptRes.status === "fulfilled" && Array.isArray(deptRes.value?.data)) {
          setDepartments(deptRes.value.data);
        }
        if (desigRes.status === "fulfilled" && Array.isArray(desigRes.value?.data)) {
          setDesignations(desigRes.value.data);
        }
      } catch {}
    };
    loadRefs();
  }, []);

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d.code ? `${d.name} (${d.code})` : d.name])),
    [departments]
  );

  const desigMap = useMemo(
    () => new Map(designations.map((d) => [d.id, d.code ? `${d.name} (${d.code})` : d.name])),
    [designations]
  );

  return (
    <AppShell title="Employees">
      <MasterDataPage
        title="Employee"
        description="Manage employee records"
        path="/master-data/employee"
        searchPlaceholder="Search employees..."
        fields={[
          { key: "employeeCode", label: "Employee Code", required: true, autoCodePrefix: "EMP", placeholder: "e.g. EMP-0001" },
          { key: "firstName", label: "First Name", required: true, placeholder: "e.g. John" },
          { key: "lastName", label: "Last Name", required: true, placeholder: "e.g. Doe" },
          { key: "email", label: "Email", type: "email", required: true, placeholder: "john@company.com" },
          { key: "phone", label: "Phone", placeholder: "e.g. +92-300-1234567" },
          {
            key: "gender",
            label: "Gender",
            type: "select",
            required: true,
            placeholder: "Select gender...",
            options: [
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ],
          },
          {
            key: "departmentId",
            label: "Department",
            type: "select",
            entityLabel: "Department",
            quickAddType: "department",
            onQuickCreated: (created) => setDepartments((prev) => [created, ...prev]),
            placeholder: "Select department...",
            options: departments.map((d) => ({
              value: d.id,
              label: d.code ? `${d.name} (${d.code})` : d.name,
            })),
            renderCell: (val) => (val ? deptMap.get(String(val)) || String(val) : "—"),
          },
          {
            key: "designationId",
            label: "Designation",
            type: "select",
            entityLabel: "Designation",
            quickAddType: "designation",
            onQuickCreated: (created) => setDesignations((prev) => [created, ...prev]),
            placeholder: "Select designation...",
            options: designations.map((d) => ({
              value: d.id,
              label: d.code ? `${d.name} (${d.code})` : d.name,
            })),
            renderCell: (val) => (val ? desigMap.get(String(val)) || String(val) : "—"),
          },
          { key: "bankName", label: "Bank Name", placeholder: "e.g. HBL" },
          { key: "bankAccount", label: "Bank Account", placeholder: "e.g. 1234-5678-9012" },
          { key: "panNumber", label: "PAN Number", placeholder: "e.g. PAN-123456" },
        ]}
      />
    </AppShell>
  );
}
