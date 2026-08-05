"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToMenu() {
  const pathname = usePathname();

  if (pathname === "/" || pathname.startsWith("/login")) {
    return null;
  }

  return (
    <Link href="/" className="back-to-menu">
      ← Voltar ao menu
    </Link>
  );
}
