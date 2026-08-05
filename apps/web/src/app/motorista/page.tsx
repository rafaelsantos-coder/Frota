import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { MotoristaClient } from "./motorista-client";

export default function MotoristaPage() {
  return (
    <RequireAuth>
      <Shell>
        <MotoristaClient />
      </Shell>
    </RequireAuth>
  );
}
