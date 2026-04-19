import { useListAiDecisions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowDownToLine, ArrowUpToLine, Shuffle, PlayCircle, PauseCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Ads() {
  const { data: decisions = [], isLoading } = useListAiDecisions();

  // Group decisions by date
  const groupedDecisions = decisions.reduce((acc, decision) => {
    const date = format(new Date(decision.executedAt), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(decision);
    return acc;
  }, {} as Record<string, typeof decisions>);

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'increase_budget': return <ArrowUpToLine className="w-5 h-5 text-green-500" />;
      case 'decrease_budget': return <ArrowDownToLine className="w-5 h-5 text-orange-500" />;
      case 'shift_budget': return <Shuffle className="w-5 h-5 text-blue-500" />;
      case 'pause_ad': return <PauseCircle className="w-5 h-5 text-red-500" />;
      case 'start_ad': return <PlayCircle className="w-5 h-5 text-primary" />;
      default: return <Sparkles className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="space-y-2 text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">قرارات الذكاء الاصطناعي</h1>
        <p className="text-lg text-muted-foreground">سجل كامل بكل ما نقوم به نيابة عنك لتحسين أداء حملاتك.</p>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-8 w-32" />
          <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
      ) : Object.keys(groupedDecisions).length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-lg">
          لا توجد قرارات مسجلة بعد. نحن بصدد تحليل بياناتك.
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedDecisions).map(([date, dayDecisions]) => (
            <div key={date} className="space-y-4">
              <h2 className="text-xl font-bold sticky top-16 bg-background/95 backdrop-blur py-2 z-10">
                {format(new Date(date), 'EEEE، d MMMM', { locale: ar })}
              </h2>
              <div className="space-y-4">
                {dayDecisions.map(decision => (
                  <Card key={decision.id} className="overflow-hidden border-s-4 border-s-primary transition-all hover:shadow-md">
                    <CardContent className="p-6 flex gap-4">
                      <div className="mt-1">
                        {getDecisionIcon(decision.decisionType)}
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-lg font-semibold text-foreground leading-snug">
                            {decision.reasonArabic}
                          </p>
                          <span className="text-sm text-muted-foreground whitespace-nowrap ms-4">
                            {format(new Date(decision.executedAt), 'h:mm a', { locale: ar })}
                          </span>
                        </div>
                        {decision.resultArabic && (
                          <div className="inline-block mt-2 bg-muted px-3 py-1.5 rounded-md text-sm font-medium text-foreground">
                            النتيجة: {decision.resultArabic}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}