import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetAudienceSize } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArabicNumber } from "@/lib/format";
import { Sparkles, ArrowLeft, TrendingUp } from "lucide-react";

type Analysis = {
  hasData: boolean;
  summary: string | null;
  recommendation: { product_name: string; suggested_budget_sar: number; reason_arabic: string } | null;
  disclaimerArabic?: string;
};

export default function Success() {
  const [, setLocation] = useLocation();
  const { data: audience, isLoading } = useGetAudienceSize();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  useEffect(() => {
    fetch("/api/onboarding/campaign-analysis", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAnalysis(d))
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }, []);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-xl w-full space-y-8 text-center">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
            <div className="relative w-24 h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-xl">
              <Sparkles className="w-12 h-12" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-foreground">اكتمل الإعداد بنجاح</h1>
        <p className="text-xl text-muted-foreground">
          حسابك جاهز الآن. مسوّقك الذكي بدأ في تحليل متجرك وتجهيز حملاتك الأولى.
        </p>

        <Card className="bg-primary/5 border-primary/20 mt-8">
          <CardContent className="p-8">
            {isLoading ? (
              <div className="space-y-4 flex flex-col items-center">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-32" />
              </div>
            ) : audience ? (
              <div className="space-y-2">
                <p className="text-lg text-muted-foreground">جمهور جاهز للوصول إليه:</p>
                <div className="text-4xl font-bold text-primary flex items-center justify-center gap-2">
                  <span dir="ltr">{formatArabicNumber(audience.totalBuyers)}</span>
                  <span>مشتري</span>
                </div>
                <p className="text-md text-foreground mt-2">في فئة {audience.segmentDisplayName}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {analysisLoading ? (
          <Card className="bg-card border-border mt-4">
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </CardContent>
          </Card>
        ) : analysis ? (
          <Card className="bg-card border-primary/20 mt-4 text-right">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <TrendingUp className="w-5 h-5" />
                <span className="font-bold">تحليل حملاتك السابقة</span>
              </div>
              {analysis.summary && (
                <p className="text-foreground leading-relaxed">{analysis.summary}</p>
              )}
              {analysis.recommendation && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="text-sm text-muted-foreground mb-1">توصية الإطلاق</div>
                  <div className="font-bold text-lg">{analysis.recommendation.product_name}</div>
                  <div className="text-sm text-foreground mt-1">
                    ميزانية مقترحة: <span className="font-bold">{formatArabicNumber(analysis.recommendation.suggested_budget_sar)}</span> ر.س / يوم
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">{analysis.recommendation.reason_arabic}</div>
                </div>
              )}
              {analysis.disclaimerArabic && (
                <p className="text-xs text-muted-foreground">{analysis.disclaimerArabic}</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="pt-8">
          <Button 
            size="lg" 
            className="h-14 px-12 text-lg rounded-full group"
            onClick={() => setLocation("/")}
          >
            الانتقال للوحة التحكم
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}