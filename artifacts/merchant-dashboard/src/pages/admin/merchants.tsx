import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/admin";
import { formatArabicNumber } from "@/lib/format";
import { AdminShell, AdminCard } from "@/components/admin-shell";

type Merchant = {
  id: string;
  storeName: string;
  category: string | null;
  subCategory: string | null;
  city: string | null;
  plan: string | null;
  status: string;
  createdAt: string;
};

export default function AdminMerchants() {
  const [, setLocation] = useLocation();
  const [list, setList] = useState<Merchant[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Merchant[]>("/admin/merchants")
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch((e) => {
        setError((e as Error).message);
        if ((e as Error).message === "unauthorized") setLocation("/admin/login");
      });
  }, [setLocation]);

  const filtered = list.filter((m) => m.storeName.toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell title="التجّار" subtitle={`${formatArabicNumber(list.length)} تاجر مسجّل`}>
      <input
        placeholder="بحث باسم المتجر..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
      />

      {error && error !== "unauthorized" && <div className="text-red-300 mb-4 text-sm">{error}</div>}

      <AdminCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-slate-300">
            <tr>
              <th className="text-right p-3 font-medium">المتجر</th>
              <th className="text-right p-3 font-medium">الفئة</th>
              <th className="text-right p-3 font-medium">المدينة</th>
              <th className="text-right p-3 font-medium">الباقة</th>
              <th className="text-right p-3 font-medium">الحالة</th>
              <th className="text-right p-3 font-medium">منذ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">لا توجد نتائج.</td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="p-3 font-medium">{m.storeName}</td>
                  <td className="p-3 text-slate-400">{m.category ?? "—"}{m.subCategory ? ` / ${m.subCategory}` : ""}</td>
                  <td className="p-3 text-slate-400">{m.city ?? "—"}</td>
                  <td className="p-3 text-slate-400">{m.plan ?? "—"}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${m.status === "active" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {m.status === "active" ? "نشط" : m.status === "trialing" ? "تجريبي" : m.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 text-xs">{new Date(m.createdAt).toLocaleDateString("ar-SA")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminCard>
    </AdminShell>
  );
}
