import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminFetch } from "@/lib/admin";
import { ChevronLeft } from "lucide-react";
import { formatArabicNumber } from "@/lib/format";

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
    <div className="min-h-[100dvh] bg-background p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin"><Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">التجّار</h1>
            <p className="text-sm text-muted-foreground">{formatArabicNumber(list.length)} تاجر مسجّل</p>
          </div>
        </div>

        <Input placeholder="بحث باسم المتجر..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />

        {error && error !== "unauthorized" && <div className="text-red-600 mb-4">{error}</div>}

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-right p-3">المتجر</th>
                  <th className="text-right p-3">الفئة</th>
                  <th className="text-right p-3">المدينة</th>
                  <th className="text-right p-3">الباقة</th>
                  <th className="text-right p-3">الحالة</th>
                  <th className="text-right p-3">منذ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{m.storeName}</td>
                    <td className="p-3 text-muted-foreground">{m.category ?? "—"}{m.subCategory ? ` / ${m.subCategory}` : ""}</td>
                    <td className="p-3 text-muted-foreground">{m.city ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{m.plan ?? "—"}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${m.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {m.status === "active" ? "نشط" : m.status === "trialing" ? "تجريبي" : m.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{new Date(m.createdAt).toLocaleDateString("ar-SA")}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
