"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "SEARCH" },
  { href: "/analytics", label: "ANALYTICS" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-20 flex-col justify-between gap-4 border-b-[3px] border-ink px-4 py-4 sm:flex-row sm:items-center sm:px-8">
      <Link href="/" className="text-lg font-bold tracking-[-0.05em] sm:text-xl">
        🛍 CATALOGUE//INTELLIGENCE
      </Link>
      <div className="flex gap-6 text-sm font-bold sm:text-base">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "text-link underline decoration-[3px] underline-offset-4" : "hover:text-accent"}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
