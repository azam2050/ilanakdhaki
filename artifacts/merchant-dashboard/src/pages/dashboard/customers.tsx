import { useGetCustomersOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArabicNumber, formatPercentage } from "@/lib/format";
import { Users, MapPin, UserCircle2, Package } from "lucide-react";

const AGE_LABEL: Record<string, string> = {
  "18-24": "١٨–٢٤",
  "25-34": "٢٥–٣٤",
  "35-44": "٣٥–٤٤",
  "45-54": "٤٥–٥٤",
  "55+": "٥٥+",
};

export default function Customers() {
  const { data, isLoading } = useGetCustomersOverview();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">جمهورك</h1>
        <p className="text-muted-foreground">من مشتريات متجرك</p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-primary/15 text-primary rounded-xl">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-medium text-muted-foreground">
                إجمالي العملاء
              </h3>
              <p className="text-xs text-muted-foreground">
                من مشتريات متجرك
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-12 w-48" />
          ) : (
            <div className="text-5xl font-bold text-primary">
              {formatArabicNumber(data?.totalCustomers ?? 0)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              توزيع المدن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {isLoading
                ? Array(5)
                    .fill(0)
                    .map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                : data?.cityDistribution.map((c) => (
                    <div key={c.city} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.city}</span>
                        <span className="text-muted-foreground">
                          {formatPercentage(c.share)}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${c.share}%` }}
                        />
                      </div>
                    </div>
                  ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-primary" />
              الفئة العمرية لعملائك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {isLoading
                ? Array(3)
                    .fill(0)
                    .map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                : data?.ageDistribution.map((a) => (
                    <div key={a.bracket} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {AGE_LABEL[a.bracket] ?? a.bracket}
                        </span>
                        <span className="text-muted-foreground">
                          {formatPercentage(a.share)}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${a.share}%` }}
                        />
                      </div>
                    </div>
                  ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            أكثر ما يشترون
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading
              ? Array(5)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              : data?.topProducts.map((p, idx) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {formatArabicNumber(idx + 1)}
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatArabicNumber(p.orders)} طلب
                    </div>
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
