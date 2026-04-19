import { useGetTodayMetrics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArabicNumber, formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Reports() {
  const { data: metrics, isLoading } = useGetTodayMetrics();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">التقارير</h1>
          <p className="text-muted-foreground">ملخص أداء المتجر المالي</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            تاريخ مخصص
          </Button>
          <div className="flex bg-muted rounded-md p-1">
            <Button variant="ghost" size="sm" className="bg-background shadow-sm">اليوم</Button>
            <Button variant="ghost" size="sm">أسبوع</Button>
            <Button variant="ghost" size="sm">شهر</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            الملخص الشامل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-4">
            <ReportItem 
              label="إجمالي الطلبات" 
              value={formatArabicNumber(metrics?.orders)} 
              loading={isLoading} 
            />
            <ReportItem 
              label="إجمالي الإيرادات" 
              value={formatCurrency(metrics?.revenue)} 
              loading={isLoading} 
              highlight
            />
            <ReportItem 
              label="إجمالي الإنفاق الإعلاني" 
              value={formatCurrency(metrics?.spend)} 
              loading={isLoading} 
            />
            <ReportItem 
              label="متوسط تكلفة الطلب" 
              value={formatCurrency(metrics?.costPerOrder)} 
              loading={isLoading} 
            />
            <ReportItem 
              label="العائد على الإنفاق (ROAS)" 
              value={metrics?.roas ? formatArabicNumber(metrics.roas) + 'x' : undefined} 
              loading={isLoading} 
              highlight
            />
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-border border-dashed">
        <p>تقارير تفصيلية قريباً...</p>
      </div>
    </div>
  );
}

function ReportItem({ label, value, loading, highlight = false }: { label: string, value?: string, loading?: boolean, highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-primary/5 border border-primary/20' : ''}`}>
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      {loading ? (
        <Skeleton className="h-10 w-32" />
      ) : (
        <p className={`text-3xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value || '---'}
        </p>
      )}
    </div>
  );
}