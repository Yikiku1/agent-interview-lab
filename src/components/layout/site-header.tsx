"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "概览" },
  { href: "/practice", label: "练习" },
  { href: "/questions", label: "题库" },
  { href: "/review", label: "复习" },
  { href: "/stats", label: "统计" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto grid max-w-[var(--content-width)] grid-cols-[1fr_auto] items-center gap-x-5 px-4 py-2 sm:min-h-18 sm:grid-cols-[auto_1fr_auto] sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 text-sm font-semibold"
        >
          <span
            className="flex size-8 items-center justify-center rounded-md bg-accent-soft font-mono text-xs font-semibold text-accent"
            aria-hidden="true"
          >
            AI
          </span>
          面试训练台
        </Link>
        <nav
          aria-label="主导航"
          className="order-3 col-span-2 flex items-center gap-1 border-t border-border pt-2 sm:order-none sm:col-span-1 sm:justify-center sm:border-0 sm:pt-0"
        >
          {links.map(({ href, label }) => {
            const selected =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex-none",
                  selected && "bg-accent-soft font-medium text-accent",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          title="切换明暗主题"
          aria-label="切换明暗主题"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
      </div>
    </header>
  );
}
