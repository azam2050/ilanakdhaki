import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon, Upload, Sparkles, Trash2, Loader2, AlertCircle } from "lucide-react";

type Item = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  kind: string;
  status: "pending" | "analyzed" | "failed" | "skipped";
  viewUrl: string | null;
  aiAnalysis: {
    headline_arabic?: string;
    summary_arabic?: string;
    tags?: string[];
    suggested_caption?: string;
    score?: number;
  } | null;
  createdAt: string;
};

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageReady, setStorageReady] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/ad-library", { credentials: "include" });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setStorageReady(data.storageConfigured !== false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/ad-library", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `http_${res.status}`);
      }
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "storage_not_configured") setError("لم يتم إعداد التخزين بعد. تواصل مع الدعم.");
      else if (msg === "unsupported_type") setError("نوع الملف غير مدعوم. استخدم صور (JPG/PNG/WebP) أو فيديو (MP4).");
      else setError("فشل الرفع. حاول مرة أخرى.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    if (!confirm("هل تريد حذف هذا الملف؟")) return;
    await fetch(`/api/ad-library/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ImageIcon className="w-7 h-7 text-primary" />
            مكتبة صور الإعلانات
          </h1>
          <p className="text-muted-foreground mt-2">
            ارفع صور وفيديوهات منتجاتك ليحلّلها الذكاء الاصطناعي ويقترح نصوص إعلانية مناسبة.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            onChange={onUpload}
            className="hidden"
          />
          <Button
            size="lg"
            disabled={uploading || !storageReady}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? "جاري الرفع..." : "رفع ملف جديد"}
          </Button>
        </div>
      </div>

      {!storageReady && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-amber-800 text-sm">
              التخزين السحابي غير مفعّل بعد. تواصل مع فريق الدعم لتفعيل المكتبة.
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">المكتبة فارغة. ارفع أول صورة لمنتجاتك.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <Card key={it.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative overflow-hidden">
                {it.viewUrl && it.kind === "image" ? (
                  <img src={it.viewUrl} alt={it.fileName} className="w-full h-full object-cover" />
                ) : it.viewUrl && it.kind === "video" ? (
                  <video src={it.viewUrl} className="w-full h-full object-cover" controls />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium truncate">{it.fileName}</div>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(it.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                {it.status === "pending" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري التحليل...
                  </div>
                )}
                {it.status === "skipped" && (
                  <div className="text-xs text-muted-foreground">فيديو — التحليل التلقائي للصور فقط حالياً.</div>
                )}
                {it.status === "failed" && (
                  <div className="text-xs text-red-600">تعذّر التحليل التلقائي.</div>
                )}
                {it.status === "analyzed" && it.aiAnalysis && (
                  <div className="space-y-2">
                    {it.aiAnalysis.headline_arabic && (
                      <div className="font-bold text-foreground flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {it.aiAnalysis.headline_arabic}
                      </div>
                    )}
                    {it.aiAnalysis.suggested_caption && (
                      <div className="text-sm text-foreground bg-primary/5 border border-primary/10 rounded-lg p-2 leading-relaxed">
                        {it.aiAnalysis.suggested_caption}
                      </div>
                    )}
                    {it.aiAnalysis.tags && it.aiAnalysis.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {it.aiAnalysis.tags.map((t, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {typeof it.aiAnalysis.score === "number" && (
                      <div className="text-xs text-muted-foreground">
                        تقييم الجودة الإعلانية: <span className="font-bold text-foreground">{it.aiAnalysis.score}/١٠</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
