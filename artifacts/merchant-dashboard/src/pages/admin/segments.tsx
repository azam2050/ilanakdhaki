import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/admin";
import { formatArabicNumber } from "@/lib/format";
import { AdminShell, AdminCard } from "@/components/admin-shell";

type Segment = {
  id: string;
  name: string;
  displayName: string;
  totalBuyers: number;
  totalMerchants: number;
};

export default function AdminSegments() {
  const [, setLocation] = useLocation();
  const [list, setList] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ segments: Segment[] } | Segment[]>("/admin/segments")
      .then((d) => {
        const arr = Array.isArray(d) ? d : d?.segments;
        setList(Array.isArray(arr) ? arr : []);
      })
      .catch((e) => {
        setError((e as Error).message);
        if ((e as Error).message === "unauthorized") setLocation("/admin/login");
      });
  }, [setLocation]);

  return (
    <AdminShell title="فئات الجمهور" subtitle="شبكة المشترين عبر التجار">
      {error && error !== "unauthorized" && (
        <div className="text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {list === null ? (
        <div className="text-slate-400">جاري التحميل…</div>
      ) : (list || []).length === 0 ? (
        <AdminCard className="p-10 text-center">
          <div className="text-slate-300 font-medium">لا توجد شرائح بعد</div>
          <div className="text-sm text-slate-500 mt-1">سيتم إنشاء الشرائح تلقائياً مع نمو شبكة المشترين.</div>
        </AdminCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(list || []).map((s) => (
            <AdminCard key={s.id} className="p-5">
              <div className="text-lg font-bold mb-1">{s.displayName}</div>
              <div className="text-xs text-slate-500 mb-4">{s.name}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">المشترون</div>
                  <div className="text-2xl font-bold text-amber-300">{formatArabicNumber(s.totalBuyers)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">التجّار</div>
                  <div className="text-2xl font-bold">{formatArabicNumber(s.totalMerchants)}</div>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
