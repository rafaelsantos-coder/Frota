import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { ManutencaoClient } from "./manutencao-client";

export default function ManutencaoPage() {
  return (
    <RequireAuth>
      <Shell>
        <ManutencaoClient />
      </Shell>
    </RequireAuth>
  );
}
