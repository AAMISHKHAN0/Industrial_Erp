"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { MasterDataPage } from "@/components/shared/master-data-page";

export default function CustomersPage() {
  return (
    <AppShell title="Customers">
      <MasterDataPage
        title="Customer"
        description="Manage customer records and accounts"
        path="/sales/customers"
        searchPlaceholder="Search customers..."
        fields={[
          { key: "customerCode", label: "Customer Code", required: true, autoCodePrefix: "CUST", placeholder: "e.g. CUST-0001" },
          { key: "name", label: "Customer Name", required: true, placeholder: "e.g. ABC Textiles" },
          { key: "contactPerson", label: "Contact Person", placeholder: "e.g. Mr. Ahmed" },
          { key: "phone", label: "Phone", placeholder: "e.g. +92-300-1234567" },
          { key: "email", label: "Email", type: "email", placeholder: "contact@customer.com", isMoreDetail: true },
          { key: "address", label: "Address", type: "textarea", placeholder: "Full customer address", isMoreDetail: true },
          { key: "city", label: "City", placeholder: "e.g. Faisalabad", isMoreDetail: true },
          { key: "state", label: "State", placeholder: "e.g. Punjab", isMoreDetail: true },
          { key: "country", label: "Country", placeholder: "e.g. Pakistan", isMoreDetail: true },
          { key: "paymentTerms", label: "Payment Terms", placeholder: "e.g. Net 30", isMoreDetail: true },
          { key: "taxNumber", label: "Tax Number (NTN / STRN)", placeholder: "e.g. NTN-7654321", isMoreDetail: true },
          { key: "rating", label: "Rating", type: "number", placeholder: "e.g. 5", isMoreDetail: true },
          { key: "creditLimit", label: "Credit Limit", type: "number", placeholder: "e.g. 500000", isMoreDetail: true },
        ]}
      />
    </AppShell>
  );
}
