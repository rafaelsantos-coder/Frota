import { RequireAuth } from "@/components/require-auth";
import { RequireAdmin } from "@/components/require-admin";
import { Shell } from "@/components/shell";
import { AdminUsuariosClient } from "./usuarios-client";

export default function AdminUsuariosPage() {
  return (
    <RequireAuth>
      <Shell>
        <RequireAdmin>
          <AdminUsuariosClient />
        </RequireAdmin>
      </Shell>
    </RequireAuth>
  );
}
