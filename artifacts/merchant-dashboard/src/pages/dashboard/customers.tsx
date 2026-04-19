import { useGetAudienceSize, useGetCityBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArabicNumber, formatPercentage } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Globe, Building2, TrendingUp } from "lucide-react";

export default function Customers() {
  const { data: audience, isLoading: loadingAudience } = useGetAudienceSize();
  const { data: cities = [], isLoading: loadingCities } = useGetCityBreakdown();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">جمهورك والشبكة</h1>
        <p className="text-muted-foreground">تعرف على المشترين المحتملين في شبكتنا الإعلانية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 text-primary rounded-xl">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-muted-foreground">المشترون المحتملون</h3>
                <p className="text-sm text-muted-foreground">في فئة {audience?.segmentDisplayName || "متجرك"}</p>
              </div>
            </div>
            {loadingAudience ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <div className="text-5xl font-bold text-primary">
                {formatArabicNumber(audience?.totalBuyers)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-muted-foreground">المتاجر المشتركة</h3>
                <p className="text-sm text-muted-foreground">نتعلم من بيانات الشبكة معاً</p>
              </div>
            </div>
            {loadingAudience ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <div className="text-5xl font-bold text-foreground">
                {formatArabicNumber(audience?.totalMerchants)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              توزيع جمهور الشبكة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {loadingAudience ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                audience?.topCities.map(city => (
                  <div key={city.city} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{city.city}</span>
                      <span className="text-muted-foreground">{formatPercentage(city.share)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all" 
                        style={{ width: `${city.share}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              مبيعاتك الجغرافية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingCities ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (
                cities.map(city => (
                  <div key={city.city} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-medium text-lg">{city.city}</span>
                    </div>
                    <div className="text-xl font-bold">{formatArabicNumber(city.orders)} طلب</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}