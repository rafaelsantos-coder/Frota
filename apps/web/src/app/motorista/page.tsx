import { RequireAuth } from "@/components/require-auth";
import { MotoristaClient } from "./motorista-client";

export default function MotoristaPage() {
  return (
    <RequireAuth>
      <MotoristaClient />
    </RequireAuth>
  );
}
