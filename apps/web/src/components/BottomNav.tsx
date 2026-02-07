"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/discover", label: "Discover", icon: "\u2665" },
  { href: "/matches", label: "Matches", icon: "\u2733" },
  { href: "/chat", label: "Chat", icon: "\u2709" },
  { href: "/profile", label: "Profile", icon: "\u2022" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950 safe-bottom z-50">
        <div className="container-mobile flex justify-around py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? "text-brand-500"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* Spacer for bottom nav */}
      <div className="h-20" />
    </>
  );
}
