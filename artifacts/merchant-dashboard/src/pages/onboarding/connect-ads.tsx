import { useLocation } from "wouter";
import { useListAdAccounts, useGetAdAccountConnectUrl, useMockConnectAdAccount, getListAdAccountsQueryKey, getGetMeQueryKey, getGetAdAccountConnectUrlQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SiMeta, SiSnapchat, SiTiktok, SiGoogle } from "react-icons/si";

type Platform = "meta" | "snap" | "tiktok" | "google";

const PLATFORMS: { id: Platform; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { id: "meta", label: "ميتا", description: "اربط حسابك الإعلاني على ميتا وانستقرام", icon: SiMeta, color: "text-blue-600" },
  { id: "snap", label: "سناب شات", description: "اربط حسابك الإعلاني على سناب شات", icon: SiSnapchat, color: "text-yellow-400" },
  { id: "tiktok", label: "تيك توك", description: "اربط حسابك الإعلاني على تيك توك", icon: SiTiktok, color: "text-black dark:text-white" },
  { id: "google", label: "جوجل", description: "اربط حسابك الإعلاني على جوجل", icon: SiGoogle, color: "text-red-500" },
];

function PlatformCard({ platform, connected }: { platform: typeof PLATFORMS[0], connected: boolean }) {
  const queryClient = useQueryClient();
  const { data: connectUrlInfo, isLoading: isLoadingUrl } = useGetAdAccountConnectUrl({ platform: platform.id }, {
    query: { enabled: !connected, queryKey: getGetAdAccountConnectUrlQueryKey({ platform: platform.id }) }
  });
  
  const mockConnect = useMockConnectAdAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    }
  });

  const handleConnect = () => {
    if (connectUrlInfo?.available && connectUrlInfo.url) {
      window.location.href = connectUrlInfo.url;
    } else if (connectUrlInfo?.available === false) {
      mockConnect.mutate({ platform: platform.id });
    }
  };

  const Icon = platform.icon;

  return (
    <Card className={`relative overflow-hidden transition-all ${connected ? 'border-primary/50 bg-primary/5' : 'hover:border-border/80'}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-background shadow-sm ${platform.color}`}>
              <Icon size={28} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{platform.label}</h3>
              {connected ? (
                <p className="text-sm text-primary flex items-center gap-1 mt-1">
                  <CheckCircle2 size={14} /> متصل بنجاح
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {platform.description}
                </p>
              )}
            </div>
          </div>
          
          {!connected && (
            <Button
              onClick={handleConnect}
              disabled={isLoadingUrl || mockConnect.isPending}
            >
              {mockConnect.isPending ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : null}
              ربط الحساب
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConnectAds() {
  const [, setLocation] = useLocation();
  const { data: accounts = [], isLoading } = useListAdAccounts();

  const connectedPlatforms = accounts.map(a => a.platform);
  const hasAnyConnection = connectedPlatforms.length > 0;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">ربط المنصات الإعلانية</h1>
          <p className="text-lg text-muted-foreground">
            اربط حساباتك الإعلانية وسيقوم الذكاء الاصطناعي بإدارتها وتوزيع الميزانية لتحقيق أفضل عائد.
          </p>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            PLATFORMS.map(platform => (
              <PlatformCard 
                key={platform.id} 
                platform={platform} 
                connected={connectedPlatforms.includes(platform.id)} 
              />
            ))
          )}
        </div>

        <div className="pt-8 flex justify-center border-t border-border/50">
          <Button 
            size="lg"
            className="px-12 text-lg h-14"
            disabled={!hasAnyConnection}
            onClick={() => setLocation("/onboarding/success")}
          >
            إكمال الإعداد
          </Button>
        </div>
        {!hasAnyConnection && !isLoading && (
          <p className="text-center text-sm text-muted-foreground">
            يجب ربط منصة واحدة على الأقل للمتابعة
          </p>
        )}
      </div>
    </div>
  );
}