import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminFetch } from "@/lib/admin";
import { AdminShell, AdminCard } from "@/components/admin-shell";
import { KeyRound, UserPlus, Trash2, Mail } from "lucide-react";

type Member = { id: string; email: string; role: string; createdAt: string; lastLoginAt: string | null; pendingInvite: boolean };
type Me = { role: "super" | "employee"; email: string | null; source: "env" | "session"; needsPasswordSetup: boolean };

export default function AdminSettings() {
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, t] = await Promise.all([
        adminFetch<Me>("/admin/auth/me"),
        adminFetch<Member[]>("/admin/team"),
      ]);
      setMe(m);
      setTeam(t);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (msg === "unauthorized") setLocation("/admin/login");
      if (msg === "http_403") setLocation("/admin");
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="الإعدادات" subtitle="كلمة المرور وأعضاء الفريق">
      {error && error !== "unauthorized" && error !== "http_403" && (
        <div className="text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <PasswordCard onSaved={() => void load()} bootstrap={me?.source === "env"} />
        <TeamCard team={team} onChanged={() => void load()} />
      </div>
    </AdminShell>
  );
}

function PasswordCard({ onSaved, bootstrap }: { onSaved: () => void; bootstrap: boolean }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null); setMsg(null);
    if (next.length < 8) { setErr("كلمة المرور الجديدة يجب ألّا تقل عن ٨ أحرف"); return; }
    if (next !== confirm) { setErr("كلمتا المرور غير متطابقتين"); return; }
    setSaving(true);
    try {
      const res = await adminFetch<{ ok: true; bootstrap?: boolean }>("/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      setMsg(res.bootstrap ? "تم تعيين كلمة المرور بنجاح. استخدمها في المرات القادمة." : "تم تحديث كلمة المرور.");
      setCur(""); setNext(""); setConfirm("");
      onSaved();
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === "http_401" ? "كلمة المرور الحالية غير صحيحة" : "تعذّر الحفظ، حاول مجدداً");
    } finally { setSaving(false); }
  }

  return (
    <AdminCard className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-5 h-5 text-amber-400" />
        <h2 className="font-bold text-lg">كلمة المرور</h2>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        {bootstrap
          ? "أنت تستخدم كلمة المرور الافتراضية. عيّن كلمة جديدة لتأمين الحساب."
          : "غيّر كلمة المرور بشكل دوري للحفاظ على أمان الحساب."}
      </p>
      <div className="space-y-3">
        <Field label="كلمة المرور الحالية" type="password" value={cur} onChange={setCur} />
        <Field label="كلمة المرور الجديدة" type="password" value={next} onChange={setNext} />
        <Field label="تأكيد كلمة المرور الجديدة" type="password" value={confirm} onChange={setConfirm} />
        {err && <div className="text-sm text-red-300">{err}</div>}
        {msg && <div className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">{msg}</div>}
        <button
          onClick={save}
          disabled={saving || !cur || !next || !confirm}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold py-2.5 rounded-lg"
        >
          {saving ? "جاري الحفظ..." : "حفظ كلمة المرور"}
        </button>
      </div>
    </AdminCard>
  );
}

function TeamCard({ team, onChanged }: { team: Member[]; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function add() {
    setErr(null); setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr("بريد إلكتروني غير صالح"); return; }
    setAdding(true);
    try {
      const res = await adminFetch<{ ok: true; emailSent: boolean; inviteToken: string | null }>(
        "/admin/team",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      setInfo(res.emailSent
        ? "تم إرسال رابط الدعوة إلى البريد الإلكتروني."
        : `لم يتم تكوين البريد. شارك هذا الرابط يدوياً مع الموظف:\n/admin/login?email=${encodeURIComponent(email)}&t=${res.inviteToken}`);
      setEmail("");
      onChanged();
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === "http_409" ? "هذا البريد مضاف من قبل" : "تعذّر الإضافة");
    } finally { setAdding(false); }
  }

  async function remove(id: string, em: string) {
    if (!confirm(`هل أنت متأكد من إزالة ${em}؟`)) return;
    try {
      await adminFetch(`/admin/team/${id}`, { method: "DELETE" });
      onChanged();
    } catch { /* ignore */ }
  }

  return (
    <AdminCard className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="w-5 h-5 text-amber-400" />
        <h2 className="font-bold text-lg">أعضاء الفريق (موظفون)</h2>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        الموظفون يشاهدون اللوحة فقط. لا يمكنهم تعديل الإعدادات أو حذف التجار أو الوصول للبيانات المالية.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="email"
          dir="ltr"
          placeholder="employee@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={add}
          disabled={adding || !email}
          className="bg-amber-500 disabled:opacity-50 text-slate-900 font-bold px-4 rounded-lg flex items-center gap-1.5"
        >
          <Mail className="w-4 h-4" />
          دعوة
        </button>
      </div>
      {err && <div className="text-sm text-red-300 mb-3">{err}</div>}
      {info && <div className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 mb-3 whitespace-pre-line break-all">{info}</div>}

      {team.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-700 rounded-lg">
          لا يوجد موظفون مضافون بعد.
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {team.filter((m) => m.role !== "super").map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100 truncate">{m.email}</div>
                <div className="text-xs text-slate-500">
                  أُضيف: {new Date(m.createdAt).toLocaleDateString("ar-SA")}
                  {" • "}
                  آخر دخول: {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString("ar-SA") : "لم يدخل بعد"}
                  {m.pendingInvite && <span className="text-amber-400 mr-1">• دعوة معلّقة</span>}
                </div>
              </div>
              <button
                onClick={() => remove(m.id, m.email)}
                className="text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                إزالة
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
      />
    </label>
  );
}
