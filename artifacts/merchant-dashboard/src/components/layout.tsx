import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  const [location] = useLocation();

  const isDashboard =
    location === "/" ||
    location === "/performance" ||
    location === "/customers" ||
    location === "/ads" ||
    location === "/reports" ||
    location === "/settings";

  if (!isDashboard) {
    return <main className="min-h-screen bg-background font-sans">{children}</main>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-foreground font-sans">
              {isLoading ? <Skeleton className="h-6 w-32" /> : me?.storeName}
            </span>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/" active={location === "/"}>
                الرئيسية
              </NavLink>
              <NavLink href="/performance" active={location === "/performance"}>
                الأداء
              </NavLink>
              <NavLink href="/customers" active={location === "/customers"}>
                العملاء
              </NavLink>
              <NavLink href="/ads" active={location === "/ads"}>
                الإعلانات
              </NavLink>
              <NavLink href="/library" active={location === "/library"}>
                مكتبة الصور
              </NavLink>
              <NavLink href="/alerts" active={location === "/alerts"}>
                التنبيهات
              </NavLink>
              <NavLink href="/reports" active={location === "/reports"}>
                التقارير
              </NavLink>
              <NavLink href="/settings" active={location === "/settings"}>
                الإعدادات
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}