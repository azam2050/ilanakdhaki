import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, User, CreditCard, Link as LinkIcon, LogOut, CheckCircle2 } from "lucide-react";
import { SiMeta, SiSnapchat, SiTiktok, SiGoogle } from "react-icons/si";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  meta: SiMeta,
  snap: SiSnapchat,
  tiktok: SiTiktok,
  google: SiGoogle,
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "ميتا",
  snap: "سناب شات",
  tiktok: "تيك توك",
  google: "جوجل",
};

export default function Settings() {
  const { data: me, isLoading } = useGetMe();
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        window.location.href = "/onboarding/welcome";
      }
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground">إدارة حسابك والمنصات المتصلة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              بيانات المتجر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">اسم المتجر</p>
              {isLoading ? <Skeleton className="h-6 w-48" /> : <p className="font-semibold text-lg">{me?.storeName}</p>}
            </div>
            {me?.ownerName && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">المالك</p>
                <p className="font-semibold text-lg">{me.ownerName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">الباقة الحالية</p>
              {isLoading ? <Skeleton className="h-6 w-32" /> : <p className="font-semibold text-lg">{me?.plan}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              المنصات المتصلة
            </CardTitle>
            <CardDescription>المنصات التي نديرها لك حالياً</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : me?.connectedPlatforms.length === 0 ? (
              <p className="text-muted-foreground">لا توجد منصات متصلة</p>
            ) : (
              me?.connectedPlatforms.map(platform => {
                const Icon = PLATFORM_ICONS[platform] || LinkIcon;
                return (
                  <div key={platform} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-foreground" />
                      <span className="font-medium">{PLATFORM_LABELS[platform] || platform}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="pt-8 border-t border-border flex justify-end">
        <Button 
          variant="destructive" 
          size="lg"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="w-5 h-5 ms-2" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}