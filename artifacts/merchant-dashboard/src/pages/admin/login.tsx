import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { setAdminToken } from "@/lib/admin";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill from email invite link: ?email=...&t=...
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    const t = params.get("t");
    if (e) setEmail(e);
    if (t) setPassword(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, email: email || undefined }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "بيانات الدخول غير صحيحة" : "حدث خطأ، حاول مرة أخرى");
        return;
      }
      const data = (await res.json()) as { token: string };
      setAdminToken(data.token, remember);
      setLocation("/admin");
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">لوحة إدارة المنصة</h1>
          <p className="text-sm text-slate-400 mt-1">دخول مخصّص للفريق التشغيلي</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">البريد الإلكتروني (اختياري للمسؤول الرئيسي)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pl-10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white"
                  aria-label={showPw ? "إخفاء" : "إظهار"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-amber-500"
              />
              تذكّرني على هذا الجهاز
            </label>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold py-2.5 rounded-lg transition"
            >
              {loading ? "جاري التحقّق..." : "دخول"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          الإعلانات الذكية © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
