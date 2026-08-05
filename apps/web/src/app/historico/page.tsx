import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { HistoricoClient } from "./historico-client";

export default function HistoricoPage() {
  return (
    <Shell>
      <Suspense fallback={<p className="muted">Carregando…</p>}>
        <HistoricoClient />
      </Suspense>
    </Shell>
  );
}
