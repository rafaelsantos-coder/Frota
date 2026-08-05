import { RequireAuth } from "@/components/require-auth";
import { MotoristasClient } from "./motoristas-client";

export default function MotoristasPage() {
  return (
    <RequireAuth>
      <MotoristasClient />
    </RequireAuth>
  );
}
