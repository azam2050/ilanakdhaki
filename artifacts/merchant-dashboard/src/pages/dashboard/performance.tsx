import { useGetPlatformBreakdown, useGetCityBreakdown, useGetTodayMetrics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArabicNumber, formatCurrency, formatPercentage } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, MapPin, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";

export default function Performance() {
  const { data: platforms = [], isLoading: loadingPlatforms } = useGetPlatformBreakdown();
  const { data: cities = [], isLoading: loadingCities } = useGetCityBreakdown();
  const { data: metrics, isLoading: loadingMetrics } = useGetTodayMetrics();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">الأداء</h1>
        <p className="text-muted-foreground">نظرة تفصيلية على أداء القنوات والمدن</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              أداء المنصات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlatforms ? (
              <div className="h-[300px] flex items-center justify-center"><Skeleton className="h-[250px] w-full" /></div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platforms} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="platformLabelArabic" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => formatArabicNumber(value)}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                      formatter={(value: number) => [formatArabicNumber(value), '']}
                    />
                    <Bar dataKey="orders" name="الطلبات" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              حصة المنصات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPlatforms ? (
              <div className="h-[300px] flex items-center justify-center"><Skeleton className="h-[250px] w-[250px] rounded-full" /></div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platforms}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="share"
                      nameKey="platformLabelArabic"
                    >
                      {platforms.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatPercentage(value), 'الحصة']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            التوزيع الجغرافي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingCities ? (
              Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : (
              cities.map(city => (
                <div key={city.city} className="bg-muted/30 rounded-lg p-5 border border-border/50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{city.city}</h3>
                    <div className="text-primary font-bold text-xl">{formatArabicNumber(city.orders)}</div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">أفضل الأحياء:</p>
                    {city.topDistricts.slice(0, 3).map(district => (
                      <div key={district.district} className="flex justify-between text-sm">
                        <span>{district.district}</span>
                        <span className="text-muted-foreground">{formatArabicNumber(district.orders)} طلب</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}