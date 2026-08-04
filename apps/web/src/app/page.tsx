import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Shell>
        <DashboardClient />
      </Shell>
    </RequireAuth>
  );
}
