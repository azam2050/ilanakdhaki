import { useLocation } from "wouter";
import { useSaveConsent, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Megaphone, Lock, Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const ITEMS = [
  {
    icon: Package,
    title: "متجرك",
    body: "نقرأ منتجاتك ومبيعاتك لنفهم عملاءك",
  },
  {
    icon: Megaphone,
    title: "إعلاناتك",
    body: "ندير حملاتك الإعلانية بدلاً عنك",
  },
  {
    icon: Lock,
    title: "خصوصيتك",
    body: "بياناتك مشفرة ولا تُشارك مع أي طرف",
  },
];

export default function Consent() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const saveConsent = useSaveConsent({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        setLocation("/onboarding/connect-ads");
      },
    },
  });

  const handleAccept = () => {
    saveConsent.mutate({
      data: {
        readStoreData: true,
        receiveWebhooks: true,
        shareAudienceNetwork: true,
        manageAdAccounts: true,
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-base font-semibold text-foreground">
              الإعلانات الذكية
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            خطوة واحدة للبدء
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            نحتاج إذنك لإدارة إعلاناتك باحترافية
          </p>
        </div>

        <ul className="space-y-5 mb-10">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <div className="shrink-0 w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-base font-semibold text-foreground mb-1">
                  {title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <Button
          className="w-full h-12 text-base font-semibold"
          disabled={saveConsent.isPending}
          onClick={handleAccept}
          data-testid="button-accept-consent"
        >
          {saveConsent.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mx-2" />
          ) : null}
          موافق وابدأ مجاناً
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
          بالمتابعة أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
