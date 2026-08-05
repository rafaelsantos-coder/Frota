import { RequireAuth } from "@/components/require-auth";
import { MultasClient } from "./multas-client";

export default function MultasPage() {
  return (
    <RequireAuth>
      <MultasClient />
    </RequireAuth>
  );
}
