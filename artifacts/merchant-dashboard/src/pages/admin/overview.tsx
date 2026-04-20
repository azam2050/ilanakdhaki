import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminFetch, clearAdminToken } from "@/lib/admin";
import { LogOut, Users, ShoppingBag, Megaphone, TrendingUp } from "lucide-react";
import { formatArabicNumber } from "@/lib/format";

type Overview = {
  activeMerchants: number;
  activeCampaigns: number;
  spendTodaySar: number;
  ordersToday: number;
  purchasesLast24h: number;
};

export default function AdminOverview() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Overview>("/admin/overview")
      .then(setData)
      .catch((e) => {
        setError((e as Error).message);
        if ((e as Error).message === "unauthorized") setLocation("/admin/login");
      });
  }, [setLocation]);

  function logout() {
    clearAdminToken();
    setLocation("/admin/login");
  }

  return (
    <div className="min-h-[100dvh] bg-background p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">لوحة الأدمن</h1>
            <p className="text-muted-foreground">نظرة عامة على المنصة</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/merchants"><Button variant="outline">التجّار</Button></Link>
            <Link href="/admin/segments"><Button variant="outline">الفئات</Button></Link>
            <Button variant="ghost" onClick={logout}><LogOut className="w-4 h-4 ml-1" />خروج</Button>
          </div>
        </div>

        {error && error !== "unauthorized" && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4 text-red-700">
              {error === "admin_not_configured" ? "لم يتم ضبط ADMIN_TOKEN في الخادم." : `خطأ: ${error}`}
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={Users} label="تجّار نشطون" value={formatArabicNumber(data.activeMerchants)} sub="حسابات فعالة" />
            <StatCard icon={Megaphone} label="حملات نشطة" value={formatArabicNumber(data.activeCampaigns)} sub="عبر كل المنصات" />
            <StatCard icon={ShoppingBag} label="طلبات اليوم" value={formatArabicNumber(data.ordersToday)} sub="من الحملات" />
            <StatCard icon={TrendingUp} label="الصرف اليوم" value={`${formatArabicNumber(Math.round(data.spendTodaySar))} ر.س`} sub="إجمالي المنصة" />
            <StatCard icon={ShoppingBag} label="مشتريات آخر ٢٤ ساعة" value={formatArabicNumber(data.purchasesLast24h)} sub="عبر شبكة المتاجر" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
