import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/admin";
import { AdminShell, AdminCard } from "@/components/admin-shell";
import { formatArabicNumber } from "@/lib/format";
import {
  Users,
  ShoppingBag,
  Megaphone,
  TrendingUp,
  Send,
  FileSpreadsheet,
  CalendarPlus,
  Activity,
} from "lucide-react";

type Realtime = { activeMerchants: number; spendTodaySar: number; ordersToday: number; avgOrderCostSar: number };
type ActivityItem = {
  id: string; actorEmail: string | null; action: string; targetType: string | null;
  targetId: string | null; summary: string | null; occurredAt: string;
};
type Me = { role: "super" | "employee" };

const ACTION_AR: Record<string, string> = {
  login: "تسجيل دخول",
  password_change: "تغيير كلمة المرور",
  team_add: "إضافة موظف",
  team_remove: "إزالة موظف",
  broadcast: "إرسال إشعار جماعي",
  export_merchants: "تصدير قائمة التجار",
  season_add: "إضافة موسم جديد",
  campaign_pause: "إيقاف حملة",
  campaign_resume: "استئناف حملة",
  budget_change: "تعديل ميزانية",
};

export default function AdminOverview() {
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Realtime | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showSeason, setShowSeason] = useState(false);

  async function refresh() {
    try {
      const [m, s] = await Promise.all([
        adminFetch<Me>("/admin/auth/me"),
        adminFetch<Realtime>("/admin/stats/realtime"),
      ]);
      setMe(m);
      setStats(s);
      if (m.role === "super") {
        const a = await adminFetch<ActivityItem[]>("/admin/activity");
        setActivity(a);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (msg === "unauthorized") setLocation("/admin/login");
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      adminFetch<Realtime>("/admin/stats/realtime").then(setStats).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  function exportCsv() {
    const token = localStorage.getItem("smart_ads_admin_token");
    if (!token) return;
    fetch("/api/admin/export/merchants.csv", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "merchants.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <AdminShell title="نظرة عامة" subtitle="حالة المنصة في الوقت الحالي">
      {error && error !== "unauthorized" && (
        <div className="text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-sm">
          {error === "admin_not_configured" ? "لم يتم ضبط ADMIN_TOKEN في الخادم." : `خطأ: ${error}`}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="المتاجر النشطة" value={formatArabicNumber(stats?.activeMerchants ?? 0)} />
        <StatCard icon={Megaphone} label="الإنفاق اليوم" value={`${formatArabicNumber(stats?.spendTodaySar ?? 0)} ر.س`} />
        <StatCard icon={ShoppingBag} label="الطلبات اليوم" value={formatArabicNumber(stats?.ordersToday ?? 0)} />
        <StatCard icon={TrendingUp} label="متوسط تكلفة الطلب" value={`${formatArabicNumber(stats?.avgOrderCostSar ?? 0)} ر.س`} />
      </div>

      {me?.role === "super" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <QuickAction icon={Send} label="إرسال إشعار لجميع التجار" onClick={() => setShowBroadcast(true)} />
          <QuickAction icon={FileSpreadsheet} label="تصدير تقرير Excel" onClick={exportCsv} />
          <QuickAction icon={CalendarPlus} label="إضافة موسم جديد" onClick={() => setShowSeason(true)} />
        </div>
      )}

      {me?.role === "super" && (
        <AdminCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold">سجل آخر العمليات</h2>
          </div>
          {activity.length === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">لا توجد عمليات حتى الآن.</div>
          ) : (
            <div className="space-y-1">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-slate-800/40 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-200">
                      {ACTION_AR[a.action] ?? a.action}
                      {a.summary && <span className="text-slate-400 font-normal"> — {a.summary}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{a.actorEmail ?? "—"}</div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(a.occurredAt).toLocaleString("ar-SA")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      )}

      {showBroadcast && <BroadcastDialog onClose={() => { setShowBroadcast(false); void refresh(); }} />}
      {showSeason && <SeasonDialog onClose={() => { setShowSeason(false); void refresh(); }} />}
    </AdminShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </AdminCard>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 rounded-xl p-4 text-right flex items-center gap-3 transition"
    >
      <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-medium text-slate-100">{label}</span>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function BroadcastDialog({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ recipients: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setSending(true); setErr(null);
    try {
      const r = await adminFetch<{ recipients: number }>("/admin/broadcast", { method: "POST", body: JSON.stringify({ message: msg }) });
      setDone(r);
    } catch (e) { setErr((e as Error).message); }
    finally { setSending(false); }
  }

  return (
    <Modal title="إرسال إشعار لجميع التجار" onClose={onClose}>
      {done ? (
        <div>
          <div className="text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">
            تم تسجيل الإشعار لـ {formatArabicNumber(done.recipients)} تاجر.
          </div>
          <button onClick={onClose} className="w-full mt-4 bg-amber-500 text-slate-900 font-bold py-2.5 rounded-lg">إغلاق</button>
        </div>
      ) : (
        <>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={5}
            placeholder="اكتب رسالتك هنا..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          {err && <div className="text-red-300 text-sm mt-2">{err}</div>}
          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 bg-slate-800 text-slate-200 font-medium py-2.5 rounded-lg">إلغاء</button>
            <button disabled={!msg || sending} onClick={send} className="flex-1 bg-amber-500 disabled:opacity-50 text-slate-900 font-bold py-2.5 rounded-lg">
              {sending ? "جاري الإرسال..." : "إرسال"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function SeasonDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await adminFetch("/admin/seasonal-alerts", {
        method: "POST",
        body: JSON.stringify({ nameArabic: name, triggerDate: date, triggerDaysBefore: days }),
      });
      setDone(true);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="إضافة موسم جديد" onClose={onClose}>
      {done ? (
        <div>
          <div className="text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">تم إضافة الموسم.</div>
          <button onClick={onClose} className="w-full mt-4 bg-amber-500 text-slate-900 font-bold py-2.5 rounded-lg">إغلاق</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input label="اسم الموسم (عربي)" value={name} onChange={setName} />
          <Input label="تاريخ الموسم" value={date} onChange={setDate} type="date" dir="ltr" />
          <Input label="بداية التنبيه قبل (أيام)" value={String(days)} onChange={(v) => setDays(Number(v) || 7)} type="number" dir="ltr" />
          {err && <div className="text-red-300 text-sm">{err}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-slate-800 text-slate-200 font-medium py-2.5 rounded-lg">إلغاء</button>
            <button disabled={!name || !date || saving} onClick={save} className="flex-1 bg-amber-500 disabled:opacity-50 text-slate-900 font-bold py-2.5 rounded-lg">
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Input({ label, value, onChange, type = "text", dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
      />
    </label>
  );
}
