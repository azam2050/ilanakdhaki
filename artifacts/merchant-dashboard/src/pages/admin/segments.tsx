import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin";
import { ChevronLeft } from "lucide-react";
import { formatArabicNumber } from "@/lib/format";

type Segment = {
  id: string;
  name: string;
  displayName: string;
  totalBuyers: number;
  totalMerchants: number;
};

export default function AdminSegments() {
  const [, setLocation] = useLocation();
  const [list, setList] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ segments: Segment[] }>("/admin/segments")
      .then((d) => setList(d.segments))
      .catch((e) => {
        setError((e as Error).message);
        if ((e as Error).message === "unauthorized") setLocation("/admin/login");
      });
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] bg-background p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin"><Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">فئات الجمهور</h1>
            <p className="text-sm text-muted-foreground">شبكة المشترين عبر التجار</p>
          </div>
        </div>

        {error && error !== "unauthorized" && <div className="text-red-600 mb-4">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="text-lg font-bold mb-1">{s.displayName}</div>
                <div className="text-xs text-muted-foreground mb-3">{s.name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">المشترون</div>
                    <div className="text-xl font-bold">{formatArabicNumber(s.totalBuyers)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">التجّار</div>
                    <div className="text-xl font-bold">{formatArabicNumber(s.totalMerchants)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
