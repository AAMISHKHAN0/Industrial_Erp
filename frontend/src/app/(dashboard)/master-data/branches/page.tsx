"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";

export default function BranchesPage() {
  return (
    <AppShell title="Branches">
      <MasterDataPage
        title="Branch"
        description="Manage branch locations"
        path="/master-data/branch"
        searchPlaceholder="Search branches..."
        fields={[
          { key: "name", label: "Branch Name", required: true, placeholder: "e.g. Lahore Office" },
          { key: "code", label: "Branch Code", required: true, autoCodePrefix: "BR", placeholder: "e.g. BR-0001" },
          { key: "email", label: "Email", type: "email", placeholder: "branch@company.com" },
          { key: "phone", label: "Phone", placeholder: "e.g. +92-300-1234567" },
          { key: "city", label: "City", placeholder: "e.g. Lahore" },
          { key: "state", label: "State", placeholder: "e.g. Punjab" },
          { key: "country", label: "Country", placeholder: "e.g. Pakistan" },
        ]}
      />
    </AppShell>
  );
}