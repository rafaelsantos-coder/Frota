import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { IntegrationsClient } from "./integrations-client";

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <Shell>
        <IntegrationsClient />
      </Shell>
    </RequireAuth>
  );
}
