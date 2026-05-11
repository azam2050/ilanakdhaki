import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";

type Mode = "login" | "register";

export default function MerchantLogin() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regStoreName, setRegStoreName] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "حدث خطأ، حاول مرة أخرى");
        return;
      }
      setLocation("/");
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون ٨ أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/register`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          storeName: regStoreName,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "حدث خطأ أثناء إنشاء الحساب");
        return;
      }
      setLocation("/onboarding/consent");
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">مسوّقك الذكي</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === "login" ? "سجّل دخولك لمتابعة متجرك" : "أنشئ حسابك وابدأ مجاناً"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 mb-5">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "login"
                ? "bg-amber-500 text-slate-900"
                : "text-slate-400 hover:text-white"
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "register"
                ? "bg-amber-500 text-slate-900"
                : "text-slate-400 hover:text-white"
            }`}
          >
            إنشاء حساب
          </button>
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
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
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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

              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "جاري التحقّق..." : "دخول"}
              </button>

              <p className="text-center text-xs text-slate-500 mt-2">
                ما عندك حساب؟{" "}
                <button type="button" onClick={() => { setMode("register"); setError(null); }} className="text-amber-400 hover:underline">
                  أنشئ حساباً مجانياً
                </button>
              </p>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">اسم المتجر</label>
                <input
                  type="text"
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  required
                  placeholder="مثال: متجر العود الفاخر"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">كلمة المرور (٨ أحرف على الأقل)</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pl-10 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    autoComplete="new-password"
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

              {error && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب مجاني"}
              </button>

              <p className="text-center text-xs text-slate-500 leading-relaxed">
                بالتسجيل أنت توافق على{" "}
                <a href="/terms" className="text-amber-400 hover:underline">شروط الاستخدام</a>
                {" "}و{" "}
                <a href="/privacy" className="text-amber-400 hover:underline">سياسة الخصوصية</a>
              </p>

              <p className="text-center text-xs text-slate-500 mt-1">
                عندك حساب؟{" "}
                <button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-amber-400 hover:underline">
                  سجّل دخولك
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          مسوّقك الذكي © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
