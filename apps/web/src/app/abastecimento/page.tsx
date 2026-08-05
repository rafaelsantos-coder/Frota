import { RequireAuth } from "@/components/require-auth";
import { AbastecimentoClient } from "./abastecimento-client";

export default function AbastecimentoPage() {
  return (
    <RequireAuth>
      <AbastecimentoClient />
    </RequireAuth>
  );
}
