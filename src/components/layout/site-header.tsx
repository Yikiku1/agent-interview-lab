"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  BookOpen,
  Layers3,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "概览", icon: Layers3 },
  { href: "/practice", label: "刷题", icon: BookOpen },
  { href: "/questions", label: "题库", icon: BookOpen },
  { href: "/review", label: "复习", icon: RotateCcw },
  { href: "/stats", label: "统计", icon: BarChart3 },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-normal sm:text-base"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground font-mono text-xs text-background">
            AI
          </span>
          <span className="truncate">面试训练台</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav
            aria-label="主导航"
            className="flex items-center gap-0.5 overflow-x-auto"
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-1.5 sm:px-3 sm:text-sm",
                  (href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(href)) &&
                    "bg-muted font-medium text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            title="切换明暗主题"
            aria-label="切换明暗主题"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </Button>
        </div>
      </div>
    </header>
  );
}
