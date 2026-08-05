import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { MultasClient } from "./multas-client";

export default function MultasPage() {
  return (
    <RequireAuth>
      <Shell>
        <MultasClient />
      </Shell>
    </RequireAuth>
  );
}
