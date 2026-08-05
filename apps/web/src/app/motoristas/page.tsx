import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { MotoristasClient } from "./motoristas-client";

export default function MotoristasPage() {
  return (
    <RequireAuth>
      <Shell>
        <MotoristasClient />
      </Shell>
    </RequireAuth>
  );
}
