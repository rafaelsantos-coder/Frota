import { RequireAuth } from "@/components/require-auth";
import { ManutencaoClient } from "./manutencao-client";

export default function ManutencaoPage() {
  return (
    <RequireAuth>
      <ManutencaoClient />
    </RequireAuth>
  );
}
