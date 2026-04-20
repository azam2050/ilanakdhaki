import { useListSeasonalAlerts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = useListSeasonalAlerts();

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-7 h-7 text-primary" />
          التنبيهات الموسمية
        </h1>
        <p className="text-muted-foreground mt-2">
          نخبرك مسبقاً بكل موسم يهمّك حتى تجهّز ميزانيتك ومنتجاتك في الوقت المناسب.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">لا توجد تنبيهات موسمية حالياً.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const days = (a as { daysUntil?: number }).daysUntil ?? 0;
            const trigger = (a as { triggerDaysBefore?: number }).triggerDaysBefore ?? 7;
            const urgent = days <= trigger;
            return (
              <Card key={a.id} className={urgent ? "border-primary/40 bg-primary/5" : ""}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${urgent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{a.nameArabic}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {format(new Date(a.triggerDate), "d MMMM yyyy", { locale: ar })}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${urgent ? "text-primary" : "text-foreground"}`}>
                      {days === 0 ? "اليوم" : `${days} يوم`}
                    </div>
                    {urgent && <div className="text-xs text-primary mt-1">جهّز الميزانية</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
