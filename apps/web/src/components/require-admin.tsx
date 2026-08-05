"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return <p className="muted">Carregando…</p>;
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="panel error-panel">
        <p>Acesso restrito a administradores.</p>
      </div>
    );
  }

  return <>{children}</>;
}
