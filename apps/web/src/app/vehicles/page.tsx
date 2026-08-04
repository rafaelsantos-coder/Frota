import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { VehiclesClient } from "./vehicles-client";

export default function VehiclesPage() {
  return (
    <RequireAuth>
      <Shell>
        <VehiclesClient />
      </Shell>
    </RequireAuth>
  );
}
