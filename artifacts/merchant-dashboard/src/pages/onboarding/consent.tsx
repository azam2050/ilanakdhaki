import { useState } from "react";
import { useLocation } from "wouter";
import { useSaveConsent, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Database, Zap, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Consent() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [consents, setConsents] = useState({
    readStoreData: false,
    receiveWebhooks: false,
    shareAudienceNetwork: false,
    manageAdAccounts: false,
  });

  const saveConsent = useSaveConsent({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        setLocation("/onboarding/connect-ads");
      },
    },
  });

  const allAccepted = Object.values(consents).every(Boolean);

  const toggleConsent = (key: keyof typeof consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">الشفافية أولاً</h1>
          <p className="text-lg text-muted-foreground">
            لنعمل معاً بنجاح، نحتاج إلى بعض الصلاحيات الأساسية لربط متجرك بمنصات الإعلانات.
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-md">
                    <Database className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">قراءة بيانات المتجر</CardTitle>
                    <CardDescription>نقرأ المنتجات والأسعار لإنشاء الإعلانات تلقائياً</CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={consents.readStoreData} 
                  onCheckedChange={() => toggleConsent("readStoreData")} 
                />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-md">
                    <Zap className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">استقبال التحديثات</CardTitle>
                    <CardDescription>نستقبل تحديثات الطلبات لتحسين أداء الحملات فوراً</CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={consents.receiveWebhooks} 
                  onCheckedChange={() => toggleConsent("receiveWebhooks")} 
                />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-md">
                    <Users className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">شبكة الجمهور المشتركة</CardTitle>
                    <CardDescription>مشاركة بيانات الجمهور بشكل مجهول لتحسين الاستهداف للجميع</CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={consents.shareAudienceNetwork} 
                  onCheckedChange={() => toggleConsent("shareAudienceNetwork")} 
                />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-md">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-lg">إدارة الحسابات الإعلانية</CardTitle>
                    <CardDescription>تعديل الميزانيات وإيقاف/تشغيل الإعلانات نيابة عنك</CardDescription>
                  </div>
                </div>
                <Switch 
                  checked={consents.manageAdAccounts} 
                  onCheckedChange={() => toggleConsent("manageAdAccounts")} 
                />
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="pt-4">
          <Button 
            className="w-full h-12 text-lg font-semibold" 
            disabled={!allAccepted || saveConsent.isPending}
            onClick={() => saveConsent.mutate({ data: consents })}
          >
            {saveConsent.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-2" /> : null}
            موافق ومتابعة
          </Button>
          {!allAccepted && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              يرجى الموافقة على جميع الصلاحيات للمتابعة
            </p>
          )}
        </div>
      </div>
    </div>
  );
}