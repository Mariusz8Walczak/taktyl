"use client";
// F-002, wzorzec: pozycja nawigacji naglowka (home-setup-gear.html, naglowek). aria-current="page" dla biezacej strony.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivePath } from "../../lib/nav";

export function NavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={className}
      aria-current={isActivePath(pathname, href) ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
