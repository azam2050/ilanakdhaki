import { useEffect, useRef } from "react";
import {
  useGetMe,
  useLogout,
  useListAdAccounts,
  useDisconnectAdAccount,
  getListAdAccountsQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Link as LinkIcon,
  LogOut,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { SiMeta, SiSnapchat, SiTiktok, SiGoogle } from "react-icons/si";

type Platform = "meta" | "snap" | "tiktok" | "google";

const PLAN_LABELS: Record<string, string> = {
  trial: "تجربة مجانية ٣٠ يوم",
  basic: "البداية — ٩٩ ر.س / شهر",
  growth: "النمو — ٢٩٩ ر.س / شهر",
  pro: "الاحتراف — ٣٩٩ ر.س / شهر",
};

function planLabel(plan?: string | null): string {
  if (!plan) return "—";
  return PLAN_LABELS[plan] ?? plan;
}

const PLATFORMS: {
  id: Platform;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { id: "meta", label: "ميتا", description: "اربط حسابك الإعلاني على ميتا وانستقرام", icon: SiMeta, color: "text-blue-600" },
  { id: "snap", label: "سناب شات", description: "اربط حسابك الإعلاني على سناب شات", icon: SiSnapchat, color: "text-yellow-500" },
  { id: "tiktok", label: "تيك توك", description: "اربط حسابك الإعلاني على تيك توك", icon: SiTiktok, color: "text-foreground" },
  { id: "google", label: "جوجل", description: "اربط حسابك الإعلاني على جوجل", icon: SiGoogle, color: "text-red-500" },
];

function openOAuthPopup(platform: Platform): Window | null {
  const width = 480;
  const height = 640;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    `/api/oauth/popup/${platform}`,
    `oauth_${platform}`,
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const { data: accounts = [], isLoading: isLoadingAccounts } =
    useListAdAccounts();
  const disconnect = useDisconnectAdAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ description: "تم فصل المنصة" });
      },
    },
  });
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        window.location.href = "/onboarding/welcome";
      },
    },
  });

  const pendingPopupRef = useRef<Window | null>(null);
  const connectingRef = useRef<Platform | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as
        | { type?: string; platform?: Platform }
        | undefined;
      if (!data || data.type !== "ad-account-connected") return;
      const platform = data.platform;
      const label =
        PLATFORMS.find((p) => p.id === platform)?.label ?? platform ?? "";
      queryClient.invalidateQueries({ queryKey: getListAdAccountsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({
        description: `✅ تم ربط ${label} — يمكنك ربط باقي المنصات`,
      });
      connectingRef.current = null;
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient, toast]);

  function handleConnect(platform: Platform) {
    connectingRef.current = platform;
    const popup = openOAuthPopup(platform);
    pendingPopupRef.current = popup;
    if (!popup) {
      toast({
        description: "يرجى السماح بفتح النوافذ المنبثقة لإكمال الربط",
        variant: "destructive",
      });
      connectingRef.current = null;
      return;
    }
    const interval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(interval);
        queryClient.invalidateQueries({
          queryKey: getListAdAccountsQueryKey(),
        });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        connectingRef.current = null;
      }
    }, 600);
  }

  function handleDisconnect(accountId: string) {
    disconnect.mutate({ id: accountId });
  }

  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground">
          إدارة حسابك والمنصات المتصلة
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            بيانات المتجر
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">اسم المتجر</p>
            {isLoadingMe ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <p className="font-semibold text-lg">{me?.storeName}</p>
            )}
          </div>
          {me?.ownerName && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">المالك</p>
              <p className="font-semibold text-lg">{me.ownerName}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground mb-1">الباقة الحالية</p>
            {isLoadingMe ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <p className="font-semibold text-lg">{planLabel(me?.plan)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            المنصات المتصلة
          </CardTitle>
          <CardDescription>
            اربط أو افصل منصاتك الإعلانية في أي وقت
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingAccounts
            ? Array(4)
                .fill(0)
                .map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            : PLATFORMS.map((p) => {
                const acc = accountByPlatform.get(p.id);
                const connected = !!acc;
                const Icon = p.icon;
                const isDisconnecting =
                  disconnect.isPending && disconnect.variables?.id === acc?.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      connected
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl bg-background shadow-sm ${p.color}`}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <p className="font-semibold">{p.label}</p>
                        {connected ? (
                          <p className="text-sm text-primary flex items-center gap-1 mt-1">
                            <CheckCircle2 size={14} /> مرتبط
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(acc!.id)}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin ms-2" />
                        ) : null}
                        فصل
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(p.id)}
                      >
                        ربط الحساب
                      </Button>
                    )}
                  </div>
                );
              })}
        </CardContent>
      </Card>

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
