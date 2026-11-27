"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";

export default function DesignationsPage() {
  return (
    <AppShell title="Designations">
      <MasterDataPage
        title="Designation"
        description="Manage employee designations and job titles"
        path="/master-data/designation"
        searchPlaceholder="Search designations..."
        fields={[
          { key: "name", label: "Designation Name", required: true, placeholder: "e.g. Senior Weaving Supervisor" },
          { key: "code", label: "Code", required: true, autoCodePrefix: "DSG", placeholder: "e.g. DSG-0001" },
          { key: "description", label: "Description", placeholder: "Optional description" },
          { key: "grade", label: "Grade", placeholder: "e.g. Grade 1" },
        ]}
      />
    </AppShell>
  );
}