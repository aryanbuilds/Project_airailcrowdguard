"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  FileUp,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  Terminal,
  UserCircle,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Overview", icon: Home },
      { href: "/upload", label: "Report", icon: FileUp },
      { href: "/dashboard", label: "Control", icon: LayoutDashboard },
      { href: "/console", label: "Console", icon: Terminal },
    ],
    []
  );

  return (
    <div className="control-bg min-h-screen text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="control-grid absolute inset-0" />
      </div>

      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="glass-panel neon-edge scanline hidden h-[calc(100vh-2rem)] flex-col rounded-3xl p-4 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] text-slate-950 font-black">
              RS
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-wide">Rail Safety Command</div>
              <div className="text-[11px] text-muted-foreground">Anomaly Response • Delhi Zone</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border bg-[color:var(--rail-surface-2)]/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[color:var(--rail-accent)] opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-[color:var(--rail-accent)]" />
              </span>
              <span className="chip">Live</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</div>
          </div>

          <nav className="mt-4 grid gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-all",
                    active
                      ? "bg-gradient-to-r from-[color:var(--rail-accent)]/20 to-[color:var(--rail-accent-2)]/10 border border-white/10"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={classNames(
                    "grid size-9 place-items-center rounded-xl border",
                    active ? "bg-white/10 border-white/10" : "bg-white/5 border-white/5"
                  )}>
                    <Icon className={classNames(
                      "h-4 w-4",
                      active ? "text-[color:var(--rail-accent)]" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-[color:var(--rail-accent)] shadow-[0_0_18px_color-mix(in_oklab,var(--rail-accent)_60%,transparent)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[color:var(--rail-warning)]" />
              <div className="text-xs font-bold">Operator Mode</div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              High-visibility UI • hardened popups • safe rendering
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4">
          {/* Top bar */}
          <header className="glass-panel neon-edge flex items-center justify-between rounded-3xl px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border bg-white/5 px-3 py-2 text-sm font-bold hover:bg-white/10 lg:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                Menu
              </button>

              <div className="hidden items-center gap-2 sm:flex">
                <span className="chip">Delhi Division</span>
                <span className="chip">L2 Clearance</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden w-[320px] sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search incident / media ID"
                  className="w-full rounded-2xl border bg-white/5 px-3 py-2 pl-9 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-white/20"
                />
              </div>

              <Link
                href="/upload"
                className="hidden rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-4 py-2 text-sm font-extrabold text-slate-950 shadow-lg shadow-black/20 hover:brightness-110 sm:inline-flex"
              >
                New Report
              </Link>

              <div className="flex items-center gap-2 rounded-2xl border bg-white/5 px-3 py-2">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <div className="hidden leading-tight sm:block">
                  <div className="text-xs font-extrabold">Admin Operator</div>
                  <div className="text-[10px] text-muted-foreground">Demo Auth</div>
                </div>
              </div>
            </div>
          </header>

          {mobileOpen && (
            <div className="glass-panel neon-edge rounded-3xl p-3 lg:hidden">
              <div className="grid gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search incident / media ID"
                    className="w-full rounded-2xl border bg-white/5 px-3 py-2 pl-9 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-white/20"
                  />
                </div>
                <div className="grid gap-2">
                  {navItems.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={classNames(
                          "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-bold",
                          active
                            ? "bg-white/10 border-white/10"
                            : "bg-white/5 border-white/5"
                        )}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <main className="glass-panel neon-edge flex-1 rounded-3xl p-4 sm:p-6">
            {children}
          </main>

          <footer className="px-2 pb-2 text-[11px] text-muted-foreground">
            Rail Safety Command • Demo build • API {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
          </footer>
        </div>
      </div>
    </div>
  );
}
