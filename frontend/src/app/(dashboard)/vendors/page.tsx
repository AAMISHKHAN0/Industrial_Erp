"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";

export default function VendorsPage() {
  return (
    <AppShell title="Vendors">
      <MasterDataPage
        title="Vendor"
        description="Manage vendor records and supplier information"
        path="/purchase/vendors"
        searchPlaceholder="Search vendors..."
        fields={[
          { key: "vendorCode", label: "Vendor Code", required: true, autoCodePrefix: "VND", placeholder: "e.g. VND-0001" },
          { key: "name", label: "Vendor Name", required: true, placeholder: "e.g. XYZ Suppliers" },
          { key: "contactPerson", label: "Contact Person", placeholder: "e.g. Mr. Ali" },
          { key: "phone", label: "Phone", placeholder: "e.g. +92-300-1234567" },
          { key: "email", label: "Email", type: "email", placeholder: "info@vendor.com", isMoreDetail: true },
          { key: "address", label: "Address", type: "textarea", placeholder: "Full vendor address", isMoreDetail: true },
          { key: "city", label: "City", placeholder: "e.g. Karachi", isMoreDetail: true },
          { key: "state", label: "State", placeholder: "e.g. Sindh", isMoreDetail: true },
          { key: "country", label: "Country", placeholder: "e.g. Pakistan", isMoreDetail: true },
          { key: "paymentTerms", label: "Payment Terms", placeholder: "e.g. Net 30", isMoreDetail: true },
          { key: "taxNumber", label: "Tax Number (NTN / STRN)", placeholder: "e.g. NTN-7654321", isMoreDetail: true },
          { key: "rating", label: "Rating (1-5)", type: "number", placeholder: "e.g. 5", isMoreDetail: true },
        ]}
      />
    </AppShell>
  );
}
