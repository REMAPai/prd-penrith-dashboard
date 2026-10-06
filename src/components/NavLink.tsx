"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, status }: { href: string; label: string; status: string }) {
  const on = usePathname() === href;
  return (
    <Link href={href} className={`item ${on ? "on" : ""}`}>
      <span>{label}</span>
      <span className={`dot d-${status}`} title={status} />
    </Link>
  );
}
