import { RequireAuth } from "@/components/require-auth";
import { RequireAdmin } from "@/components/require-admin";
import { Shell } from "@/components/shell";
import { AdminLogsClient } from "./logs-client";

export default function AdminLogsPage() {
  return (
    <RequireAuth>
      <Shell>
        <RequireAdmin>
          <AdminLogsClient />
        </RequireAdmin>
      </Shell>
    </RequireAuth>
  );
}
