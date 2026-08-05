import { RequireAuth } from "@/components/require-auth";
import { RequireAdmin } from "@/components/require-admin";
import { Shell } from "@/components/shell";
import { AdminNav } from "@/components/admin-nav";
import { VehiclesClient } from "@/app/vehicles/vehicles-client";

export default function AdminVeiculosPage() {
  return (
    <RequireAuth>
      <Shell>
        <RequireAdmin>
          <div className="page-header">
            <h2>Administração — Veículos</h2>
            <p>Cadastro de veículos, rastreadores GT06 e câmeras Jimi</p>
          </div>
          <AdminNav />
          <VehiclesClient hideHeader />
        </RequireAdmin>
      </Shell>
    </RequireAuth>
  );
}
