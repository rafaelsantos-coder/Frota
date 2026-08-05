import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { AbastecimentoClient } from "./abastecimento-client";

export default function AbastecimentoPage() {
  return (
    <RequireAuth>
      <Shell>
        <AbastecimentoClient />
      </Shell>
    </RequireAuth>
  );
}
