import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
        <div className="mb-8">
          <Link href="/landing" className="inline-flex items-center text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors">
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة للرئيسية
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">سياسة الخصوصية</h1>
        <p className="text-slate-500 mb-10">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">١. التزامنا بالخصوصية</h2>
            <p>
              في "مسوّقك الذكي"، نلتزم التزاماً تاماً بحماية بياناتك الشخصية وبيانات عملائك. تمت صياغة هذه السياسة لتتوافق مع <strong>نظام حماية البيانات الشخصية (PDPL)</strong> الصادر عن الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) في المملكة العربية السعودية.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٢. البيانات التي نجمعها</h2>
            <p className="mb-2">نقوم بجمع البيانات التالية للأغراض المحددة فقط:</p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li><strong>بيانات التاجر:</strong> الاسم، البريد الإلكتروني، رقم الهاتف، واسم المتجر (لغرض إنشاء الحساب والتواصل).</li>
              <li><strong>بيانات المتجر (عبر سلة/زد):</strong> المنتجات، الطلبات، وقيمة المبيعات (لغرض تحليل الأداء وتحسين الحملات الإعلانية).</li>
              <li><strong>بيانات المنصات الإعلانية:</strong> أداء الإعلانات، التكلفة، والوصول (لغرض إدارة الميزانية وتحسين العائد).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٣. الغرض من معالجة البيانات</h2>
            <p className="mb-2">تُعالج بياناتك حصرياً للأغراض التالية:</p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li>تقديم خدمات الإدارة الذكية للإعلانات.</li>
              <li>إصدار التقارير الدورية حول أداء متجرك.</li>
              <li>الامتثال للمتطلبات القانونية والتنظيمية.</li>
            </ul>
            <p className="mt-2 font-semibold text-amber-700">
              نحن لا نقوم ببيع بياناتك أو بيانات عملائك لأي طرف ثالث تحت أي ظرف.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٤. حقوقك كصاحب بيانات (وفقاً لنظام PDPL)</h2>
            <p className="mb-2">بموجب نظام حماية البيانات الشخصية السعودي، يحق لك:</p>
            <ul className="list-disc list-inside pr-5 space-y-2">
              <li><strong>الحق في العلم:</strong> معرفة كيف ولماذا تُجمع بياناتك.</li>
              <li><strong>الحق في الوصول:</strong> طلب نسخة من بياناتك الشخصية التي نحتفظ بها.</li>
              <li><strong>الحق في التصحيح:</strong> طلب تعديل أو تحديث بياناتك غير الدقيقة.</li>
              <li><strong>الحق في الإتلاف (النسيان):</strong> طلب حذف بياناتك عند انتهاء الغرض من جمعها أو عند إلغاء اشتراكك.</li>
              <li><strong>الحق في سحب الموافقة:</strong> يمكنك سحب موافقتك على معالجة البيانات في أي وقت (مما قد يؤدي إلى إيقاف الخدمة).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٥. أمن البيانات والاحتفاظ بها</h2>
            <p>
              نستخدم أحدث تقنيات التشفير (Encryption) لحماية بياناتك أثناء النقل والتخزين. يتم الاحتفاظ ببياناتك فقط للمدة اللازمة لتقديم الخدمة أو كما تقتضيه الأنظمة السعودية. عند انتهاء هذه المدة، يتم إتلاف البيانات بطريقة آمنة.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٦. مشاركة البيانات مع أطراف ثالثة</h2>
            <p>
              قد نشارك بعض البيانات الضرورية مع مزودي خدمات موثوقين (مثل خوادم الاستضافة السحابية) والذين يلتزمون بمعايير أمان صارمة. كما نلتزم بمتطلبات منصات "سلة" و"زد" فيما يخص حماية بيانات التجار والعملاء وعدم تسريبها.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">٧. التواصل معنا</h2>
            <p>
              لممارسة حقوقك المتعلقة بالبيانات أو لأي استفسار حول سياسة الخصوصية، يمكنك التواصل مع مسؤول حماية البيانات (DPO) لدينا عبر البريد الإلكتروني: <a href="mailto:privacy@ilanakdhaki.com" className="text-amber-600 hover:underline">privacy@ilanakdhaki.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
