import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function TermsPage() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
        <div className="mb-8">
          <Link href="/landing" className="inline-flex items-center text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors">
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة للرئيسية
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">شروط الاستخدام</h1>
        <p className="text-slate-500 mb-10">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">١. مقدمة</h2>
            <p>
              مرحباً بك في منصة "مسوّقك الذكي". تحكم هذه الشروط والأحكام استخدامك لتطبيقنا وخدماتنا كتاجر (يُشار إليه بـ "التاجر" أو "أنت"). باستخدامك لخدماتنا، فإنك توافق على الالتزام بهذه الشروط بالكامل. إذا كنت لا توافق على أي جزء منها، يُرجى عدم استخدام المنصة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٢. طبيعة الخدمة وإخلاء المسؤولية</h2>
            <p className="mb-2">
              "مسوّقك الذكي" هي منصة تقنية تعتمد على الذكاء الاصطناعي لإدارة وتحسين الحملات الإعلانية الرقمية.
            </p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li><strong>النتائج غير مضمونة:</strong> نحن نقدم أدوات لتحسين الأداء، لكننا لا نضمن تحقيق مبيعات محددة، أو عوائد استثمار (ROAS) معينة، أو أرقام ثابتة. تعتمد النتائج على جودة منتجاتك، وأسعارك، وتنافسية السوق.</li>
              <li><strong>الميزانية الإعلانية:</strong> أنت المسؤول الوحيد عن الميزانية الإعلانية التي يتم إنفاقها على منصات الإعلانات (مثل سناب شات، ميتا، تيك توك، جوجل). المنصة تدير هذه الميزانية بناءً على الصلاحيات الممنوحة لها.</li>
              <li><strong>إخلاء المسؤولية:</strong> لا تتحمل المنصة أي مسؤولية قانونية أو مالية عن أي خسائر مباشرة أو غير مباشرة ناتجة عن الحملات الإعلانية.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٣. التكامل مع منصات التجارة (سلة وزد)</h2>
            <p className="mb-2">
              بصفتنا تطبيق طرف ثالث (Third-Party App) متكامل مع منصات مثل "سلة" و"زد":
            </p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li>أنت توافق على منحنا الصلاحيات اللازمة للوصول إلى بيانات متجرك (مثل المنتجات، الطلبات، والعملاء) لغرض تقديم الخدمة فقط.</li>
              <li>نحن نلتزم بسياسات المطورين الخاصة بمنصتي "سلة" و"زد"، ونخلي مسؤولية هذه المنصات عن أي نزاع ينشأ بين التاجر وتطبيق "مسوّقك الذكي".</li>
              <li>يحق لك إلغاء ربط التطبيق من لوحة تحكم متجرك في أي وقت.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٤. التزامات التاجر والمحتوى المخالف</h2>
            <p className="mb-2">يتحمل التاجر المسؤولية الكاملة عن:</p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li><strong>قانونية المنتجات:</strong> التأكد من أن المنتجات المُعلن عنها قانونية ومصرح ببيعها في المملكة العربية السعودية والأسواق المستهدفة.</li>
              <li><strong>المحتوى الإعلاني:</strong> التأكد من أن الصور، الفيديوهات، والنصوص لا تنتهك حقوق الملكية الفكرية لأي طرف ثالث، ولا تحتوي على تضليل أو احتيال.</li>
              <li><strong>سوء الاستخدام:</strong> يُمنع استخدام المنصة للترويج لمنتجات ممنوعة، أو استخدام أساليب احتيالية. يحق للمنصة إيقاف حساب التاجر فوراً ودون إشعار مسبق في حال اكتشاف أي مخالفة، مع الاحتفاظ بحق المساءلة القانونية.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٥. الرسوم والدفع</h2>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li>تُدفع رسوم الاشتراك في المنصة مقدماً حسب الباقة المختارة.</li>
              <li>الرسوم المدفوعة غير قابلة للاسترداد بعد انتهاء الفترة التجريبية المجانية (إن وُجدت)، إلا في الحالات التي ينص عليها القانون.</li>
              <li>في حال التأخر عن الدفع، يحق للمنصة إيقاف الخدمة مؤقتاً حتى يتم سداد المستحقات.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٦. التعديلات على الشروط</h2>
            <p>
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعارك بالتعديلات الجوهرية عبر البريد الإلكتروني أو من خلال لوحة التحكم. استمرارك في استخدام المنصة بعد التعديل يُعد قبولاً للشروط الجديدة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٧. القانون المطبق</h2>
            <p>
              تخضع هذه الشروط وتُفسر وفقاً للأنظمة والقوانين المعمول بها في المملكة العربية السعودية. أي نزاع ينشأ عن هذه الشروط يكون من اختصاص المحاكم السعودية.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
