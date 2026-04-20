import { useGetGreeting, useGetTodayMetrics, useListAiDecisions, useGetPlatformBreakdown, useGetCityBreakdown, useListSeasonalAlerts, useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArabicNumber, formatCurrency, formatPercentage } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Bell, Activity, Sparkles, MapPin, Zap } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Home() {
  const { data: greeting, isLoading: loadingGreeting } = useGetGreeting();
  const { data: metrics, isLoading: loadingMetrics } = useGetTodayMetrics();
  const { data: decisions = [], isLoading: loadingDecisions } = useListAiDecisions({ limit: 8 });
  const { data: platforms = [], isLoading: loadingPlatforms } = useGetPlatformBreakdown();
  const { data: cities = [], isLoading: loadingCities } = useGetCityBreakdown();
  const { data: alerts = [], isLoading: loadingAlerts } = useListSeasonalAlerts();
  const { data: me } = useGetMe();
  const isPro = me?.plan === "pro";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Greeting */}
      <div className="space-y-2">
        {loadingGreeting ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <h1 className="text-3xl font-bold text-foreground">{greeting?.greetingArabic}</h1>
        )}
        {loadingGreeting ? (
          <Skeleton className="h-5 w-96" />
        ) : (
          <p className="text-muted-foreground">{greeting?.subtitleArabic}</p>
        )}
        {isPro && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1 text-sm font-medium mt-2">
            <Zap className="w-4 h-4" />
            استهداف ذكي متقدم مفعّل
          </div>
        )}
      </div>

      {/* Alerts */}
      {!loadingAlerts && alerts.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {alerts.map(alert => (
            <div key={alert.id} className="flex-none bg-accent/50 border border-accent text-accent-foreground px-4 py-3 rounded-lg flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold text-sm">{alert.nameArabic}</p>
                <p className="text-xs opacity-80">يبدأ بعد {formatArabicNumber(alert.daysUntil)} أيام</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="الطلبات" 
          value={formatArabicNumber(metrics?.orders)} 
          delta={metrics?.deltaVsYesterday.ordersPct} 
          loading={loadingMetrics} 
        />
        <MetricCard 
          title="الإنفاق" 
          value={formatCurrency(metrics?.spend)} 
          delta={metrics?.deltaVsYesterday.spendPct} 
          loading={loadingMetrics} 
        />
        <MetricCard 
          title="الإيرادات" 
          value={formatCurrency(metrics?.revenue)} 
          delta={metrics?.deltaVsYesterday.revenuePct} 
          loading={loadingMetrics} 
        />
        <MetricCard 
          title="تكلفة الطلب" 
          value={formatCurrency(metrics?.costPerOrder)} 
          delta={metrics?.deltaVsYesterday.ordersPct ? -metrics.deltaVsYesterday.ordersPct : 0} // just for visual variance
          loading={loadingMetrics} 
          reverseColor
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AI Decisions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              ما أنجزناه اليوم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDecisions ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : decisions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">يوم هادئ — كل شي ماشي تمام 👌</p>
            ) : (
              <ul className="space-y-3">
                {decisions.map(decision => (
                  <li key={decision.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="text-lg shrink-0">✅</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground leading-snug">{decision.reasonArabic}</p>
                      {decision.resultArabic && (
                        <p className="text-sm text-primary mt-1">
                          النتيجة: {decision.resultArabic}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* Platforms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                توزيع المنصات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPlatforms ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                platforms.map(platform => (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">{platform.platformLabelArabic}</span>
                      <span className="text-muted-foreground">{formatPercentage(platform.share)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000" 
                        style={{ width: `${platform.share}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Cities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                أفضل المدن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCities ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : (
                cities.slice(0, 4).map(city => (
                  <div key={city.city} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0">
                    <span className="font-medium">{city.city}</span>
                    <span className="text-primary font-semibold">{formatArabicNumber(city.orders)} طلب</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, delta, loading, reverseColor = false }: { title: string, value: string, delta?: number, loading?: boolean, reverseColor?: boolean }) {
  const isPositive = (delta || 0) >= 0;
  const isGood = reverseColor ? !isPositive : isPositive;
  
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
        {loading ? (
          <Skeleton className="h-8 w-24 mb-2" />
        ) : (
          <div className="text-3xl font-bold text-foreground mb-2">{value}</div>
        )}
        {delta !== undefined && !loading && (
          <div className={`flex items-center text-sm ${isGood ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 me-1" /> : <TrendingDown className="w-4 h-4 me-1" />}
            <span dir="ltr">{formatPercentage(Math.abs(delta))}</span>
            <span className="text-muted-foreground ms-2">عن الأمس</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}