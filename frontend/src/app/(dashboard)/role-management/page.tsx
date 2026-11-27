import { AppShell } from "@/components/layouts/app-shell";
import { UserManagement } from "@/components/shared/user-management";

export default function RoleManagementPage() {
  return (
    <AppShell title="Role Management">
      <UserManagement />
    </AppShell>
  );
}
