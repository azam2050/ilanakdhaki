import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { customFetch } from "@workspace/api-client-react";
import {
  Wand2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Video,
  Image as ImageIcon,
  Calendar,
  Coins,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Eye,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContentTask {
  id: string;
  contentType: string;
  prompt: string;
  status: string;
  creditsCharged: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  content?: GeneratedContent[];
}

interface GeneratedContent {
  id: string;
  mediaType: string;
  textContent?: string;
  mediaUrl?: string;
  platform: string;
  metadata?: Record<string, unknown>;
}

interface ContentSchedule {
  id: string;
  contentType: string;
  promptTemplate: string;
  platform: string;
  active: boolean;
  runHour: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

interface CreditsInfo {
  balance: number;
  costs: Record<string, number>;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  return customFetch<T>(`/api${path}`);
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(`/api${path}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  } as any);
}

async function apiDelete<T>(path: string): Promise<T> {
  return customFetch<T>(`/api${path}`, { method: "DELETE" } as any);
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return customFetch<T>(`/api${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as any);
}

// ─── Content type labels ────────────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "بوست إعلاني",
  video: "فيديو إعلاني",
  story: "ستوري",
  reel: "ريلز",
};

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  post: <FileText className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  story: <ImageIcon className="w-4 h-4" />,
  reel: <Video className="w-4 h-4" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "في الانتظار",
  processing: "جاري التوليد",
  completed: "مكتمل",
  failed: "فشل",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ContentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [schedules, setSchedules] = useState<ContentSchedule[]>([]);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generate form state
  const [contentType, setContentType] = useState("post");
  const [platform, setPlatform] = useState("all");
  const [prompt, setPrompt] = useState("");

  // Schedule form state
  const [scheduleType, setScheduleType] = useState("post");
  const [schedulePlatform, setSchedulePlatform] = useState("all");
  const [schedulePrompt, setSchedulePrompt] = useState("");
  const [scheduleHour, setScheduleHour] = useState("7");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Content preview
  const [previewTask, setPreviewTask] = useState<ContentTask | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, schedulesRes, creditsRes] = await Promise.all([
        apiGet<{ tasks: ContentTask[] }>("/content/list?limit=20"),
        apiGet<{ schedules: ContentSchedule[] }>("/content/schedules"),
        apiGet<CreditsInfo>("/content/credits"),
      ]);
      setTasks(tasksRes.tasks);
      setSchedules(schedulesRes.schedules);
      setCredits(creditsRes);
    } catch (err) {
      console.error("Failed to load content data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh processing tasks
  useEffect(() => {
    const hasProcessing = tasks.some((t) => t.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiGet<{ tasks: ContentTask[] }>(
          "/content/list?limit=20",
        );
        setTasks(res.tasks);
      } catch {
        // ignore
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tasks]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "يرجى إدخال وصف المحتوى المطلوب", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const res = await apiPost<{ taskId: string; message: string }>(
        "/content/generate",
        { contentType, platform, prompt: prompt.trim() },
      );
      toast({ title: res.message });
      setPrompt("");
      await loadData();
      setActiveTab("history");
    } catch (err: any) {
      const msg =
        err?.data?.error ?? err?.message ?? "حدث خطأ أثناء توليد المحتوى";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!schedulePrompt.trim()) {
      toast({
        title: "يرجى إدخال قالب المحتوى",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiPost("/content/schedule", {
        contentType: scheduleType,
        platform: schedulePlatform,
        promptTemplate: schedulePrompt.trim(),
        runHour: parseInt(scheduleHour),
      });
      toast({ title: "تم إنشاء الجدولة بنجاح" });
      setShowScheduleDialog(false);
      setSchedulePrompt("");
      await loadData();
    } catch (err: any) {
      toast({
        title: err?.data?.error ?? "فشل إنشاء الجدولة",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await apiDelete(`/content/schedule/${id}`);
      toast({ title: "تم حذف الجدولة" });
      await loadData();
    } catch {
      toast({ title: "فشل حذف الجدولة", variant: "destructive" });
    }
  };

  const handleToggleSchedule = async (id: string, active: boolean) => {
    try {
      await apiPatch(`/content/schedule/${id}`, { active });
      await loadData();
    } catch {
      toast({ title: "فشل تحديث الجدولة", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2 text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
          <Wand2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          توليد المحتوى الإعلاني
        </h1>
        <p className="text-lg text-muted-foreground">
          أنشئ بوستات وفيديوهات إعلانية احترافية بالذكاء الاصطناعي
        </p>
      </div>

      {/* Credits Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">رصيدك الحالي</p>
              <p className="text-2xl font-bold">{credits?.balance ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">محتوى مكتمل</p>
              <p className="text-2xl font-bold">
                {tasks.filter((t) => t.status === "completed").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">جدولات نشطة</p>
              <p className="text-2xl font-bold">
                {schedules.filter((s) => s.active).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">
            <Wand2 className="w-4 h-4 ml-2" />
            توليد محتوى
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="w-4 h-4 ml-2" />
            السجل
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Calendar className="w-4 h-4 ml-2" />
            الجدولة
          </TabsTrigger>
        </TabsList>

        {/* ─── Generate Tab ──────────────────────────────────────── */}
        <TabsContent value="generate" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>إنشاء محتوى جديد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع المحتوى</Label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" /> بوست إعلاني
                        </span>
                      </SelectItem>
                      <SelectItem value="video">
                        <span className="flex items-center gap-2">
                          <Video className="w-4 h-4" /> فيديو إعلاني
                        </span>
                      </SelectItem>
                      <SelectItem value="story">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> ستوري
                        </span>
                      </SelectItem>
                      <SelectItem value="reel">
                        <span className="flex items-center gap-2">
                          <Video className="w-4 h-4" /> ريلز
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    التكلفة: {credits?.costs?.[contentType] ?? 5} رصيد
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>المنصة المستهدفة</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المنصات</SelectItem>
                      <SelectItem value="meta">
                        فيسبوك وإنستقرام
                      </SelectItem>
                      <SelectItem value="snap">سناب شات</SelectItem>
                      <SelectItem value="tiktok">تيك توك</SelectItem>
                      <SelectItem value="google">إعلانات قوقل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>وصف المحتوى المطلوب</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="مثال: أريد بوست إعلاني لعرض الصيف على فساتين السهرة، يستهدف النساء في الرياض وجدة..."
                  className="min-h-[120px] resize-y"
                  dir="rtl"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 ml-2" />
                    توليد المحتوى ({credits?.costs?.[contentType] ?? 5}{" "}
                    رصيد)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اقتراحات سريعة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  "بوست إعلاني لمنتج جديد",
                  "عرض خاص نهاية الأسبوع",
                  "محتوى تفاعلي للمتابعين",
                  "إعلان موسم الصيف",
                  "ستوري عرض اليوم",
                  "فيديو تعريفي بالمتجر",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setPrompt(suggestion)}
                    className="text-xs"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── History Tab ───────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">سجل المحتوى المولّد</h3>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 ml-1" />
              تحديث
            </Button>
          </div>

          {tasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">لم تقم بتوليد أي محتوى بعد</p>
                <p className="text-sm mt-2">
                  ابدأ بتوليد أول محتوى إعلاني من تبويب "توليد محتوى"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="overflow-hidden border-s-4 transition-all hover:shadow-md"
                  style={{
                    borderInlineStartColor:
                      task.status === "completed"
                        ? "#22c55e"
                        : task.status === "processing"
                          ? "#3b82f6"
                          : task.status === "failed"
                            ? "#ef4444"
                            : "#eab308",
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {CONTENT_TYPE_ICONS[task.contentType]}
                          <span className="font-medium text-sm">
                            {CONTENT_TYPE_LABELS[task.contentType] ??
                              task.contentType}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${STATUS_COLORS[task.status] ?? ""}`}
                          >
                            {task.status === "processing" && (
                              <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                            )}
                            {STATUS_LABELS[task.status] ?? task.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.createdAt).toLocaleDateString(
                              "ar-SA",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {task.prompt}
                        </p>
                        {task.errorMessage && (
                          <p className="text-xs text-red-500 mt-1">
                            {task.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {task.creditsCharged} رصيد
                        </span>
                        {task.status === "completed" && task.content?.length ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewTask(task)}
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            عرض
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Schedules Tab ─────────────────────────────────────── */}
        <TabsContent value="schedules" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">الجدولة التلقائية</h3>
            <Dialog
              open={showScheduleDialog}
              onOpenChange={setShowScheduleDialog}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 ml-1" />
                  جدولة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء جدولة تلقائية</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>نوع المحتوى</Label>
                    <Select
                      value={scheduleType}
                      onValueChange={setScheduleType}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">بوست إعلاني</SelectItem>
                        <SelectItem value="video">فيديو إعلاني</SelectItem>
                        <SelectItem value="story">ستوري</SelectItem>
                        <SelectItem value="reel">ريلز</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>المنصة</Label>
                    <Select
                      value={schedulePlatform}
                      onValueChange={setSchedulePlatform}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المنصات</SelectItem>
                        <SelectItem value="meta">
                          فيسبوك وإنستقرام
                        </SelectItem>
                        <SelectItem value="snap">سناب شات</SelectItem>
                        <SelectItem value="tiktok">تيك توك</SelectItem>
                        <SelectItem value="google">
                          إعلانات قوقل
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ساعة التشغيل (بتوقيت الرياض)</Label>
                    <Select
                      value={scheduleHour}
                      onValueChange={setScheduleHour}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>قالب المحتوى</Label>
                    <Textarea
                      value={schedulePrompt}
                      onChange={(e) => setSchedulePrompt(e.target.value)}
                      placeholder="مثال: أنشئ بوست إعلاني يومي يعرض أحدث المنتجات مع عرض خاص..."
                      className="min-h-[100px]"
                      dir="rtl"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                  </DialogClose>
                  <Button onClick={handleCreateSchedule}>
                    <Calendar className="w-4 h-4 ml-1" />
                    إنشاء الجدولة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {schedules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">لا توجد جدولات تلقائية</p>
                <p className="text-sm mt-2">
                  أنشئ جدولة لتوليد محتوى إعلاني جديد تلقائياً كل يوم
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {CONTENT_TYPE_ICONS[schedule.contentType]}
                          <span className="font-medium text-sm">
                            {CONTENT_TYPE_LABELS[schedule.contentType]}
                          </span>
                          <Badge variant={schedule.active ? "default" : "secondary"}>
                            {schedule.active ? "نشط" : "متوقف"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {schedule.promptTemplate}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            يومياً الساعة{" "}
                            {String(schedule.runHour).padStart(2, "0")}:00
                          </span>
                          {schedule.lastRunAt && (
                            <span>
                              آخر تشغيل:{" "}
                              {new Date(schedule.lastRunAt).toLocaleDateString(
                                "ar-SA",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          )}
                          {schedule.nextRunAt && (
                            <span>
                              التالي:{" "}
                              {new Date(schedule.nextRunAt).toLocaleDateString(
                                "ar-SA",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Switch
                          checked={schedule.active}
                          onCheckedChange={(checked) =>
                            handleToggleSchedule(schedule.id, checked)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Content Preview Dialog ──────────────────────────────── */}
      <Dialog
        open={!!previewTask}
        onOpenChange={(open) => !open && setPreviewTask(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTask &&
                CONTENT_TYPE_ICONS[previewTask.contentType]}
              {previewTask &&
                CONTENT_TYPE_LABELS[previewTask.contentType]}
            </DialogTitle>
          </DialogHeader>
          {previewTask?.content?.map((item) => {
            let parsed: Record<string, unknown> | null = null;
            try {
              if (item.textContent) {
                parsed = JSON.parse(item.textContent);
              }
            } catch {
              // plain text
            }

            return (
              <div key={item.id} className="space-y-4 py-4">
                {parsed ? (
                  <div className="space-y-4">
                    {parsed.headline && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          العنوان
                        </Label>
                        <p className="text-lg font-bold mt-1">
                          {String(parsed.headline)}
                        </p>
                      </div>
                    )}
                    {parsed.body && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          النص الإعلاني
                        </Label>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                          {String(parsed.body)}
                        </p>
                      </div>
                    )}
                    {parsed.cta && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          دعوة لاتخاذ إجراء
                        </Label>
                        <Badge variant="default" className="mt-1">
                          {String(parsed.cta)}
                        </Badge>
                      </div>
                    )}
                    {Array.isArray(parsed.hashtags) &&
                      parsed.hashtags.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            الهاشتاقات
                          </Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(parsed.hashtags as string[]).map((tag, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    {parsed.platform_notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          ملاحظات المنصة
                        </Label>
                        <p className="text-sm mt-1 text-muted-foreground">
                          {String(parsed.platform_notes)}
                        </p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const text = [
                          parsed!.headline,
                          "",
                          parsed!.body,
                          "",
                          parsed!.cta,
                          "",
                          Array.isArray(parsed!.hashtags)
                            ? (parsed!.hashtags as string[])
                                .map((t) => `#${t}`)
                                .join(" ")
                            : "",
                        ]
                          .filter(Boolean)
                          .join("\n");
                        copyToClipboard(text);
                      }}
                    >
                      <Copy className="w-4 h-4 ml-1" />
                      نسخ المحتوى
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {item.textContent}
                    </p>
                    {item.textContent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => copyToClipboard(item.textContent!)}
                      >
                        <Copy className="w-4 h-4 ml-1" />
                        نسخ
                      </Button>
                    )}
                  </div>
                )}
                {item.mediaUrl && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      الوسائط
                    </Label>
                    <img
                      src={item.mediaUrl}
                      alt="Generated content"
                      className="mt-2 rounded-lg max-w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </DialogContent>
      </Dialog>
    </div>
  );
}
