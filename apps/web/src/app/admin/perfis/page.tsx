import { RequireAuth } from "@/components/require-auth";
import { RequireAdmin } from "@/components/require-admin";
import { Shell } from "@/components/shell";
import { AdminPerfisClient } from "./perfis-client";

export default function AdminPerfisPage() {
  return (
    <RequireAuth>
      <Shell>
        <RequireAdmin>
          <AdminPerfisClient />
        </RequireAdmin>
      </Shell>
    </RequireAuth>
  );
}
