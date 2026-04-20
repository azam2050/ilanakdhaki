import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

import Home from "@/pages/dashboard/home";
import Performance from "@/pages/dashboard/performance";
import Customers from "@/pages/dashboard/customers";
import Ads from "@/pages/dashboard/ads";
import Reports from "@/pages/dashboard/reports";
import Settings from "@/pages/dashboard/settings";
import AlertsPage from "@/pages/dashboard/alerts";
import LibraryPage from "@/pages/dashboard/library";

import Welcome from "@/pages/onboarding/welcome";
import Consent from "@/pages/onboarding/consent";
import ConnectAds from "@/pages/onboarding/connect-ads";
import Success from "@/pages/onboarding/success";

import Landing from "@/pages/landing";
import AdminLogin from "@/pages/admin/login";
import AdminOverview from "@/pages/admin/overview";
import AdminMerchants from "@/pages/admin/merchants";
import AdminSegments from "@/pages/admin/segments";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard() {
  const { data: me, isLoading, error } = useGetMe();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (error) {
      const status = (error as unknown as { status?: number; response?: { status?: number } })?.status
        ?? (error as unknown as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        if (!location.startsWith("/onboarding/welcome")) {
          setLocation("/onboarding/welcome");
        }
      }
      return;
    }

    if (me) {
      if (!me.consentAccepted && location !== "/onboarding/consent") {
        setLocation("/onboarding/consent");
      } else if (
        me.consentAccepted &&
        me.connectedPlatforms.length === 0 &&
        location !== "/onboarding/connect-ads" &&
        location !== "/onboarding/success" // Allow success if just connected
      ) {
        setLocation("/onboarding/connect-ads");
      } else if (
        me.consentAccepted &&
        me.connectedPlatforms.length > 0 &&
        location.startsWith("/onboarding") &&
        location !== "/onboarding/success"
      ) {
        setLocation("/");
      }
    }
  }, [me, isLoading, error, location, setLocation]);

  return null;
}

const PUBLIC_PATHS = new Set(["/landing", "/admin", "/admin/login", "/admin/merchants", "/admin/segments"]);

function isPublicPath(p: string): boolean {
  return PUBLIC_PATHS.has(p) || p.startsWith("/admin/");
}

function Router() {
  const [location] = useLocation();
  const isPublic = location === "/landing" || location.startsWith("/admin");

  if (isPublic) {
    return (
      <Switch>
        <Route path="/landing" component={Landing} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/merchants" component={AdminMerchants} />
        <Route path="/admin/segments" component={AdminSegments} />
        <Route path="/admin" component={AdminOverview} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Layout>
      <AuthGuard />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/performance" component={Performance} />
        <Route path="/customers" component={Customers} />
        <Route path="/ads" component={Ads} />
        <Route path="/library" component={LibraryPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />

        <Route path="/onboarding/welcome" component={Welcome} />
        <Route path="/onboarding/consent" component={Consent} />
        <Route path="/onboarding/connect-ads" component={ConnectAds} />
        <Route path="/onboarding/success" component={Success} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

void isPublicPath;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;