"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";
import { saveStoredCompany } from "@/lib/company";

export default function CompanyPage() {
  return (
    <AppShell title="Company Profile">
      <MasterDataPage
        title="Company"
        description="Manage company information"
        path="/master-data/company"
        searchPlaceholder="Search companies..."
        fields={[
          { key: "name", label: "Company Name", required: true, placeholder: "e.g. Textile Mills (Pvt) Ltd" },
          { key: "email", label: "Email", type: "email", placeholder: "info@company.com" },
          { key: "phone", label: "Phone", placeholder: "e.g. +92-42-111-2222" },
          { key: "address", label: "Address", type: "textarea", placeholder: "Full company address" },
          { key: "city", label: "City", placeholder: "e.g. Karachi" },
          { key: "country", label: "Country", placeholder: "e.g. Pakistan" },
          { key: "taxNumber", label: "Tax Number", placeholder: "e.g. NTN-1234567" },
        ]}
        onAfterSave={(saved) => {
          if (saved && saved.name) {
            saveStoredCompany({
              id: saved.id,
              name: saved.name,
              email: saved.email || "",
              phone: saved.phone || "",
              address: saved.address || "",
              taxNumber: saved.taxNumber || "",
              city: saved.city || "",
              country: saved.country || "",
            });
          }
        }}
      />
    </AppShell>
  );
}
