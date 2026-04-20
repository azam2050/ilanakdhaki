import { Client } from "pg";
import crypto from "node:crypto";

const DEMO_MERCHANT_ID = "e5059094-d3a4-414b-8358-d3fab1796636";
const DEMO_SEGMENT_ID = "11111111-1111-1111-1111-111111111111";

const c = new Client({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

async function q(sql, params = []) {
  return c.query(sql, params);
}

console.log("Wiping demo merchant data (if any)...");
await q(`DELETE FROM ai_decisions WHERE merchant_id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM network_events WHERE merchant_id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM campaigns WHERE merchant_id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM ad_accounts WHERE merchant_id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM audit_log WHERE merchant_id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM segment_audiences WHERE segment_id=$1`, [DEMO_SEGMENT_ID]);
await q(`DELETE FROM segments WHERE id=$1`, [DEMO_SEGMENT_ID]);
await q(`DELETE FROM merchants WHERE id=$1`, [DEMO_MERCHANT_ID]);
await q(`DELETE FROM seasonal_alerts`);

console.log("Inserting merchant...");
await q(
  `INSERT INTO merchants (id, salla_merchant_id, store_name, store_domain, owner_email, category, sub_category, city, region, plan, status, consents)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
  [
    DEMO_MERCHANT_ID,
    "99",
    "متجر النور للأزياء",
    "alnoor.salla.sa",
    "owner@alnoor.sa",
    "أزياء نسائية",
    "عبايات",
    "الرياض",
    "منطقة الرياض",
    "trial",
    "active",
    JSON.stringify({
      readStoreData: true,
      receiveWebhooks: true,
      shareAudienceNetwork: true,
      manageAdAccounts: true,
      acceptedAt: new Date().toISOString(),
    }),
  ],
);

console.log("Inserting segment...");
await q(
  `INSERT INTO segments (id, name, display_name, parent_category, total_merchants, total_buyers, avg_order_value, avg_cpo, best_platform, best_time, top_cities, peak_seasons)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
  [
    DEMO_SEGMENT_ID,
    "abayas_classic",
    "العبايات الكلاسيكية",
    "أزياء نسائية",
    142,
    24500,
    "385.00",
    "27.50",
    "meta",
    "20:00-23:00",
    JSON.stringify([
      { city: "الرياض", share: 0.42 },
      { city: "جدة", share: 0.23 },
      { city: "الدمام", share: 0.11 },
      { city: "مكة المكرمة", share: 0.08 },
      { city: "المدينة المنورة", share: 0.06 },
    ]),
    JSON.stringify(["رمضان", "العيدين", "موسم الحج", "العودة للمدارس"]),
  ],
);

console.log("Inserting segment audiences...");
for (const platform of ["meta", "snap", "tiktok", "google"]) {
  await q(
    `INSERT INTO segment_audiences (segment_id, platform, audience_id_external, audience_size)
     VALUES ($1,$2,$3,$4)`,
    [DEMO_SEGMENT_ID, platform, `aud_${platform}_abayas_classic`, 24500],
  );
}

console.log("Inserting ad accounts...");
const adAccountIds = {};
for (const platform of ["meta", "snap", "tiktok", "google"]) {
  const id = crypto.randomUUID();
  adAccountIds[platform] = id;
  await q(
    `INSERT INTO ad_accounts (id, merchant_id, platform, account_id_external, access_token_encrypted, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, DEMO_MERCHANT_ID, platform, `act_${platform}_demo_99`, "ENC:demo:placeholder", "active"],
  );
}

console.log("Inserting campaigns...");
const campaignIds = {};
const campaignSpec = {
  meta:   { name: "العبايات الكلاسيكية — رمضان",     budget: "180.00", spent: "142.50", orders: 23, cpo: "6.20", roas: "5.8" },
  snap:   { name: "عبايات شبابية — السناب",          budget: "120.00", spent: "98.00",  orders: 14, cpo: "7.00", roas: "4.9" },
  tiktok: { name: "إطلالات يومية — التيك توك",        budget: "150.00", spent: "131.20", orders: 19, cpo: "6.90", roas: "5.2" },
  google: { name: "بحث: عبايات الرياض",               budget: "90.00",  spent: "76.40",  orders: 11, cpo: "6.95", roas: "5.5" },
};
for (const [platform, s] of Object.entries(campaignSpec)) {
  const id = crypto.randomUUID();
  campaignIds[platform] = id;
  await q(
    `INSERT INTO campaigns (id, merchant_id, ad_account_id, platform, campaign_id_external, name, status, daily_budget, spent_today, orders_today, cost_per_order, roas, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW() - INTERVAL '14 days')`,
    [id, DEMO_MERCHANT_ID, adAccountIds[platform], platform, `cmp_${platform}_99`, s.name, "active", s.budget, s.spent, s.orders, s.cpo, s.roas],
  );
}

console.log("Inserting AI decisions...");
const decisions = [
  { type: "budget_shift",   reason: "نقلت 30 ريال من تيك توك إلى ميتا لأن تكلفة الطلب أقل بـ 11%.", result: "وفّرت 18 ريال اليوم." },
  { type: "creative_swap",  reason: "غيّرت صورة الإعلان لإعلان فيه موديل من الرياض، الجمهور يتفاعل أكثر." },
  { type: "audience_tune",  reason: "أضفت جمهور النساء 25-34 في جدة بناءً على بيانات اليومين الماضيين.", result: "زادت الطلبات 12%." },
  { type: "schedule_shift", reason: "أوقفت الإعلانات من الفجر للظهر لأن المبيعات شبه معدومة في هذي الساعات." },
  { type: "bid_adjust",     reason: "رفعت السعر للمنطقة الشرقية لأن الإعلان يخسر مزاد كثير.", result: "ظهور الإعلان زاد 22%." },
  { type: "creative_pause", reason: "أوقفت إعلان فيديو لأن نسبة الضغط نزلت تحت 0.8%." },
  { type: "budget_shift",   reason: "زدت ميزانية حملة جوجل بـ 20 ريال — ROAS عندها 5.5 وأعلى من البقية." },
  { type: "audience_tune",  reason: "استبعدت الذين اشتروا قبل 7 أيام لتجنّب صرف الميزانية على عملاء حاليين." },
];
for (const d of decisions) {
  await q(
    `INSERT INTO ai_decisions (merchant_id, campaign_id, decision_type, reason_arabic, result_arabic, executed_at)
     VALUES ($1,$2,$3,$4,$5, NOW() - (random() * INTERVAL '24 hours'))`,
    [DEMO_MERCHANT_ID, campaignIds[Object.keys(campaignIds)[Math.floor(Math.random()*4)]], d.type, d.reason, d.result || null],
  );
}

console.log("Inserting 91 purchase network events...");
const cities = [
  { city: "الرياض", districts: ["العليا", "الملقا", "النرجس", "حطين", "الياسمين"], share: 0.42 },
  { city: "جدة",    districts: ["الروضة", "الشاطئ", "السلامة", "النعيم"],          share: 0.23 },
  { city: "الدمام", districts: ["الشاطئ", "النزهة", "الفيصلية"],                   share: 0.11 },
  { city: "مكة المكرمة", districts: ["العزيزية", "الششة", "النوارية"],            share: 0.08 },
  { city: "المدينة المنورة", districts: ["قباء", "العنبرية", "السيح"],            share: 0.06 },
  { city: "الخبر",  districts: ["الراكة", "الثقبة"],                                share: 0.05 },
  { city: "الطائف", districts: ["الشهداء", "الوسام"],                               share: 0.05 },
];
const products = [
  "عباية كلاسيكية سوداء كريب",
  "عباية مطرزة بالخيوط الذهبية",
  "عباية ملونة صيفي",
  "عباية فرفرة كم واسع",
  "عباية مناسبات حرير",
  "عباية يومية قطن",
  "عباية رمضانية مطرزة",
  "عباية خروج بكتف مطرز",
];
const ageBrackets = ["18-24", "25-34", "35-44", "45-54", "55+"];
const ageWeights = [0.18, 0.42, 0.24, 0.11, 0.05];

function pickWeighted(items, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}

const cityWeights = cities.map(c => c.share);
for (let i = 0; i < 91; i++) {
  const city = pickWeighted(cities, cityWeights);
  const district = city.districts[Math.floor(Math.random() * city.districts.length)];
  const product = products[Math.floor(Math.random() * products.length)];
  const age = pickWeighted(ageBrackets, ageWeights);
  const value = (250 + Math.floor(Math.random() * 400)).toFixed(2);
  const emailHash = crypto.createHash("sha256").update(`demo-customer-${i}@example.sa`).digest("hex").slice(0, 64);
  const phoneHash = crypto.createHash("sha256").update(`+96650${1000000 + i}`).digest("hex").slice(0, 64);
  const hoursAgo = Math.floor(Math.random() * 24 * 30);
  await q(
    `INSERT INTO network_events (merchant_id, event_type, customer_email_hash, customer_phone_hash, city, district, order_value, product_category, sub_category, product_name, customer_age_bracket, occurred_at)
     VALUES ($1,'purchase',$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() - ($11 || ' hours')::interval)`,
    [DEMO_MERCHANT_ID, emailHash, phoneHash, city.city, district, value, "أزياء نسائية", "عبايات", product, age, String(hoursAgo)],
  );
}

console.log("Inserting seasonal alerts...");
const now = new Date();
const alerts = [
  { name: "رمضان المبارك",    daysBefore: 21, daysFromNow: 35, cats: ["عبايات", "ملابس"] },
  { name: "عيد الفطر",        daysBefore: 14, daysFromNow: 65, cats: ["عبايات", "هدايا", "عطور"] },
  { name: "العودة للمدارس",   daysBefore: 30, daysFromNow: 120, cats: ["ملابس أطفال", "حقائب"] },
];
for (const a of alerts) {
  const trig = new Date(now.getTime() + a.daysFromNow * 86400000);
  await q(
    `INSERT INTO seasonal_alerts (name_arabic, trigger_days_before, target_categories, trigger_date, active)
     VALUES ($1,$2,$3,$4, true)`,
    [a.name, a.daysBefore, JSON.stringify(a.cats), trig.toISOString()],
  );
}

console.log("\nFinal row counts on Railway:");
const tables = ["merchants","segments","segment_audiences","ad_accounts","campaigns","ai_decisions","network_events","seasonal_alerts","audit_log","sessions","oauth_states","processed_webhooks","ad_creatives"];
for (const t of tables) {
  const r = await q(`SELECT COUNT(*)::int AS n FROM "${t}"`);
  console.log("  " + t.padEnd(22) + r.rows[0].n);
}

await c.end();
console.log("\nDone.");
