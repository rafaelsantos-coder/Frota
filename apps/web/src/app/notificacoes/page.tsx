import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { NotificacoesClient } from "./notificacoes-client";

export default function NotificacoesPage() {
  return (
    <RequireAuth>
      <Shell>
        <NotificacoesClient />
      </Shell>
    </RequireAuth>
  );
}
