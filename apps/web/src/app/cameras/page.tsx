import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { CamerasClient } from "./cameras-client";

export default function CamerasPage() {
  return (
    <Shell>
      <Suspense fallback={<p className="muted">Carregando…</p>}>
        <CamerasClient />
      </Suspense>
    </Shell>
  );
}
