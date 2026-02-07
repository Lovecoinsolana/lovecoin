"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/discover", label: "Discover", icon: "logo" },
  { href: "/matches", label: "Matches", icon: "star" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

function NavIcon({ icon, isActive }: { icon: string; isActive: boolean }) {
  if (icon === "logo") {
    return (
      <Image
        src="/logo.png"
        alt="Discover"
        width={24}
        height={24}
        className={`h-6 w-6 ${isActive ? "opacity-100" : "opacity-50"}`}
      />
    );
  }

  if (icon === "star") {
    return (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }

  if (icon === "profile") {
    return (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }

  return null;
}

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
                <NavIcon icon={item.icon} isActive={isActive} />
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
