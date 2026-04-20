import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Plug, TrendingUp, ArrowLeft, Check } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const start = () => setLocation("/onboarding/welcome");

  return (
    <div className="min-h-[100dvh] bg-background" dir="rtl">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            الإعلانات الذكية
          </div>
          <Button size="sm" onClick={start}>ابدأ تجربتك</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-16 pb-20 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm mb-8">
          <Sparkles className="w-4 h-4" />
          إعلانات ذكية للمتاجر السعودية
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold text-foreground leading-tight">
          اترك إعلاناتك للذكاء الاصطناعي،
          <br />
          وركّز على متجرك.
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
          نحن ندير حملاتك على ميتا وسناب وتيك توك وقوقل تلقائياً، نراقب الأداء كل ١٥ دقيقة،
          ونعدّل الميزانية لما يحقّق طلبات أكثر بأقل تكلفة.
        </p>
        <div className="mt-10">
          <Button size="lg" className="h-14 px-10 text-lg rounded-full" onClick={start}>
            ابدأ مجاناً ٣٠ يوم
            <ArrowLeft className="w-5 h-5 mr-2" />
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">كيف يعمل</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Plug, title: "ثبّت", desc: "ركّب التطبيق في متجر سلة بضغطة زر." },
              { icon: Sparkles, title: "وصّل", desc: "اربط حسابات الإعلانات وحدّد ميزانيتك اليومية." },
              { icon: TrendingUp, title: "شاهد النتائج", desc: "نراقب ونحسّن تلقائياً، ويصلك تقرير يومي." },
            ].map((s, i) => (
              <Card key={i} className="border-primary/20">
                <CardContent className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-5">
                    <s.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xl font-bold mb-2">{i + 1}. {s.title}</div>
                  <p className="text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="px-4 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-foreground mb-3">قبل وبعد</h2>
        <p className="text-center text-muted-foreground mb-12">نتائج فعلية من متاجر سعودية في فئات مختلفة</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { label: "تكلفة الطلب", before: "٦٣ ريال", after: "١٨ ريال" },
            { label: "العائد على الإعلان", before: "١.٢×", after: "٤.٨×" },
            { label: "وقت الإدارة اليومي", before: "ساعتان", after: "صفر" },
          ].map((m, i) => (
            <Card key={i}>
              <CardContent className="p-6 text-center">
                <div className="text-sm text-muted-foreground mb-3">{m.label}</div>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-lg text-muted-foreground line-through">{m.before}</div>
                  <ArrowLeft className="w-5 h-5 text-primary" />
                  <div className="text-2xl font-bold text-primary">{m.after}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/30 px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">الباقات</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "البداية", price: "٩٩", desc: "للمتاجر الصغيرة", features: ["منصة واحدة", "تقرير يومي", "تحسين تلقائي"] },
              { name: "النمو", price: "٢٩٩", desc: "الأكثر طلباً", features: ["كل المنصات الأربع", "تقرير كل ٦ ساعات", "نصائح يومية بالعربي", "دعم على واتساب"], highlight: true },
              { name: "الاحتراف", price: "٣٩٩", desc: "للمتاجر الكبيرة", features: ["كل ميزات النمو", "مدير حساب مخصّص", "تحليل أعمق للجمهور", "أولوية الدعم"] },
            ].map((p, i) => (
              <Card key={i} className={p.highlight ? "border-2 border-primary shadow-xl" : "border-border"}>
                <CardContent className="p-8">
                  {p.highlight && (
                    <div className="text-center mb-3">
                      <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">الأكثر طلباً</span>
                    </div>
                  )}
                  <div className="text-2xl font-bold mb-1">{p.name}</div>
                  <div className="text-sm text-muted-foreground mb-5">{p.desc}</div>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{p.price}</span>
                    <span className="text-muted-foreground">ريال / شهرياً</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-foreground">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={p.highlight ? "default" : "outline"} onClick={start}>
                    ابدأ تجربتك المجانية
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">جميع الباقات تشمل ٣٠ يوم تجربة مجانية بدون بطاقة بنكية.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">أسئلة شائعة</h2>
        <div className="space-y-4">
          {[
            { q: "هل أحتاج خبرة بالإعلانات؟", a: "لا. التطبيق يدير كل شيء عنك، وتقاريره مكتوبة بالعربية البسيطة." },
            { q: "كم تأخذ التجربة المجانية؟", a: "٣٠ يوم كاملة، بدون الحاجة لإدخال بيانات بنكية." },
            { q: "هل تتدخّلون في حساباتي الإعلانية؟", a: "نعم، بإذنك فقط. نديرها نيابة عنك ضمن الميزانية التي تحدّدها أنت." },
            { q: "هل يدعم التطبيق متجر زد؟", a: "حالياً يدعم متجر سلة. زد قريباً." },
            { q: "كيف ألغي الاشتراك؟", a: "بضغطة زر من الإعدادات، بدون أي تعقيدات." },
          ].map((f, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="font-bold text-lg mb-2">{f.q}</div>
                <div className="text-muted-foreground">{f.a}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 px-4 py-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">© ٢٠٢٦ الإعلانات الذكية. جميع الحقوق محفوظة.</div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">سياسة الخصوصية</a>
            <a href="#" className="hover:text-foreground">شروط الاستخدام</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
