"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";

export default function DepartmentsPage() {
  return (
    <AppShell title="Departments">
      <MasterDataPage
        title="Department"
        description="Manage organizational departments"
        path="/master-data/department"
        searchPlaceholder="Search departments..."
        fields={[
          { key: "name", label: "Department Name", required: true, placeholder: "e.g. Weaving Department" },
          { key: "code", label: "Code", required: true, autoCodePrefix: "DEPT", placeholder: "e.g. DEPT-0001" },
          { key: "description", label: "Description", placeholder: "Optional description" },
        ]}
      />
    </AppShell>
  );
}