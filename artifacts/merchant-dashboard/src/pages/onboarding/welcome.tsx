import { useLocation } from "wouter";
import { useStartDemoSession, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const startDemo = useStartDemoSession({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        setLocation("/onboarding/consent");
      },
    },
  });

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground">مرحباً بك في الإعلانات الذكية</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            يدير مسوّقك الذكي إعلاناتك عبر منصات متعددة لتنمية مبيعاتك، بينما تتفرغ أنت لإدارة متجرك.
          </p>
        </div>

        <Card className="border-none shadow-lg shadow-primary/5 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <Button 
              className="w-full h-12 text-lg font-semibold shadow-md" 
              onClick={() => startDemo.mutate()}
              disabled={startDemo.isPending}
            >
              {startDemo.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-2" /> : null}
              ابدأ الآن
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}