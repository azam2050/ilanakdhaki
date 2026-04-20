import { Link, useLocation } from "wouter";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Layers,
  Settings as SettingsIcon,
  LogOut,
  Shield,
} from "lucide-react";
import { adminFetch, clearAdminToken } from "@/lib/admin";

type Me = { role: "super" | "employee"; email: string | null; source: "env" | "session"; needsPasswordSetup: boolean };

const NAV = [
  { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard, roles: ["super", "employee"] as const },
  { href: "/admin/merchants", label: "التجّار", icon: Users, roles: ["super", "employee"] as const },
  { href: "/admin/segments", label: "فئات الجمهور", icon: Layers, roles: ["super", "employee"] as const },
  { href: "/admin/settings", label: "الإعدادات", icon: SettingsIcon, roles: ["super"] as const },
];

export function AdminShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const [location, setLocation] = useLocation();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    adminFetch<Me>("/admin/auth/me")
      .then(setMe)
      .catch((e) => {
        if ((e as Error).message === "unauthorized") setLocation("/admin/login");
      });
  }, [setLocation]);

  function logout() {
    clearAdminToken();
    setLocation("/admin/login");
  }

  const items = NAV.filter((n) => !me || n.roles.includes(me.role));

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <div className="flex">
        <aside className="w-64 shrink-0 min-h-[100dvh] bg-slate-900 border-l border-slate-800 flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">لوحة الإدارة</div>
                <div className="text-xs text-slate-400">الإعلانات الذكية</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {items.map((n) => {
              const active = location === n.href || (n.href !== "/admin" && location.startsWith(n.href));
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href}>
                  <a
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      active ? "bg-amber-500/15 text-amber-300" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </a>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="text-sm font-medium">{me?.email ?? "المسؤول الرئيسي"}</div>
                <div className="text-xs text-slate-400">
                  {me?.role === "super" ? "مسؤول رئيسي" : me?.role === "employee" ? "موظف" : "—"}
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 font-bold">
                {(me?.email?.[0] ?? "م").toUpperCase()}
              </div>
            </div>
          </header>
          {me?.needsPasswordSetup && (
            <div className="mx-8 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm flex items-center justify-between">
              <span>أنت تستخدم كلمة مرور البدء الافتراضية. ننصح بتغييرها الآن.</span>
              <Link href="/admin/settings"><a className="underline font-medium">اذهب للإعدادات</a></Link>
            </div>
          )}
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>{children}</div>
  );
}
