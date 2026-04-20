import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setAdminToken, adminFetch } from "@/lib/admin";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setAdminToken(token);
      await adminFetch("/admin/overview");
      setLocation("/admin");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "admin_not_configured") {
        setError("لم يتم إعداد لوحة الأدمن في الخادم بعد. يرجى ضبط ADMIN_TOKEN.");
      } else if (msg === "unauthorized") {
        setError("الرمز غير صحيح.");
      } else {
        setError("حدث خطأ. حاول مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">لوحة الأدمن</h1>
            <p className="text-sm text-muted-foreground mt-1">دخول داخلي للفريق التشغيلي</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Input
              type="password"
              placeholder="رمز الدخول"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoFocus
              dir="ltr"
              className="text-center"
            />
            {error && <div className="text-sm text-red-600 text-center">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جاري التحقّق..." : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
