/**
 * Manus API Client
 * ────────────────
 * Wraps the Manus REST API (v2) for content generation tasks.
 *
 * Environment variable: MANUS_API_KEY
 * Base URL: https://api.manus.ai
 */

import { logger } from "./logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ManusTaskCreateParams {
  /** The user prompt / brief for content generation */
  prompt: string;
  /** Optional structured output schema for JSON responses */
  structuredOutputSchema?: Record<string, unknown>;
  /** Optional webhook URL to receive task events */
  webhookUrl?: string;
}

export interface ManusTaskCreateResponse {
  task_id: string;
  status: string;
  created_at: string;
}

export interface ManusMessage {
  role: "user" | "assistant";
  content: string;
  type?: string;
  timestamp?: string;
}

export interface ManusTaskMessagesResponse {
  task_id: string;
  status: string;
  messages: ManusMessage[];
}

export interface ManusWebhookEvent {
  event: "task_created" | "task_stopped" | "task_completed" | "task_failed";
  task_id: string;
  status?: string;
  data?: Record<string, unknown>;
}

// ─── Cost map (credits per content type) ────────────────────────────────────

export const CONTENT_CREDITS_COST: Record<string, number> = {
  post: 5,
  video: 15,
  story: 5,
  reel: 15,
};

// ─── Client ─────────────────────────────────────────────────────────────────

const MANUS_BASE_URL = "https://api.manus.ai";

function getApiKey(): string {
  const key = process.env.MANUS_API_KEY;
  if (!key) {
    throw new Error("MANUS_API_KEY environment variable is not set");
  }
  return key;
}

async function manusRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${MANUS_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-manus-api-key": getApiKey(),
  };

  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  logger.info({ method, path }, "manus_api_request");

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    logger.error(
      { status: response.status, path, errorText },
      "manus_api_error",
    );
    throw new ManusApiError(
      `Manus API error: ${response.status} ${response.statusText}`,
      response.status,
      errorText,
    );
  }

  const data = (await response.json()) as T;
  logger.info({ path, status: response.status }, "manus_api_response");
  return data;
}

export class ManusApiError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "ManusApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new Manus task for content generation.
 */
export async function createManusTask(
  params: ManusTaskCreateParams,
): Promise<ManusTaskCreateResponse> {
  const body: Record<string, unknown> = {
    message: { content: params.prompt },
  };

  if (params.structuredOutputSchema) {
    body.structured_output_schema = params.structuredOutputSchema;
  }

  if (params.webhookUrl) {
    body.webhook_url = params.webhookUrl;
  }

  return manusRequest<ManusTaskCreateResponse>("POST", "/v2/task.create", body);
}

/**
 * Poll / list messages for a given Manus task.
 */
export async function getManusTaskMessages(
  taskId: string,
): Promise<ManusTaskMessagesResponse> {
  return manusRequest<ManusTaskMessagesResponse>(
    "GET",
    `/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}`,
  );
}

/**
 * Build a structured prompt for ad content generation.
 */
export function buildContentPrompt(params: {
  storeName: string;
  category?: string | null;
  contentType: string;
  platform?: string;
  customPrompt?: string;
  topProducts?: string[];
}): string {
  const platformLabel =
    {
      meta: "فيسبوك وإنستقرام",
      snap: "سناب شات",
      tiktok: "تيك توك",
      google: "إعلانات قوقل",
      all: "جميع المنصات",
    }[params.platform ?? "all"] ?? "جميع المنصات";

  const productsList = params.topProducts?.length
    ? `أبرز المنتجات: ${params.topProducts.join("، ")}`
    : "";

  const typeInstructions: Record<string, string> = {
    post: `أنشئ بوست إعلاني احترافي يتضمن:
1. عنوان جذاب (لا يتجاوز 10 كلمات)
2. نص إعلاني رئيسي (50-100 كلمة)
3. دعوة لاتخاذ إجراء (CTA)
4. 3-5 هاشتاقات مناسبة
5. وصف تفصيلي لصورة إعلانية مقترحة (image_description) باللغة الإنجليزية لاستخدامها في توليد الصورة`,
    video: `أنشئ سكريبت فيديو إعلاني قصير (15-30 ثانية) يتضمن:
1. مشهد الافتتاح (hook) - أول 3 ثوانٍ
2. المحتوى الرئيسي - عرض المنتج/الخدمة
3. دعوة لاتخاذ إجراء (CTA)
4. وصف المشاهد المرئية لكل مقطع
5. النص المقترح للتعليق الصوتي`,
    story: `أنشئ محتوى ستوري إعلاني يتضمن:
1. نص قصير وجذاب (لا يتجاوز 20 كلمة)
2. دعوة لاتخاذ إجراء
3. وصف تفصيلي للتصميم المرئي المقترح`,
    reel: `أنشئ سكريبت ريلز/فيديو قصير (15-60 ثانية) يتضمن:
1. Hook قوي في أول 3 ثوانٍ
2. محتوى ترفيهي/تعليمي مع عرض المنتج
3. CTA في النهاية
4. اقتراحات للموسيقى والمؤثرات`,
  };

  const instruction =
    typeInstructions[params.contentType] ?? typeInstructions.post;

  return `أنت مسوّق رقمي سعودي محترف تعمل لمتجر "${params.storeName}".
الفئة: ${params.category ?? "عام"}
${productsList}
المنصة المستهدفة: ${platformLabel}

${instruction}

${params.customPrompt ? `\nملاحظات إضافية من التاجر: ${params.customPrompt}` : ""}

القواعد:
- استخدم اللهجة السعودية العامية بشكل طبيعي
- لا تستخدم إيموجي بشكل مفرط
- لا تذكر أسعار أو خصومات وهمية
- المحتوى يجب أن يكون جاهز للنشر مباشرة

أعد الإجابة بصيغة JSON بالشكل التالي:
{
  "headline": "العنوان",
  "body": "النص الرئيسي",
  "cta": "دعوة لاتخاذ إجراء",
  "hashtags": ["هاشتاق1", "هاشتاق2"],
  "image_description": "وصف الصورة بالإنجليزية",
  "platform_notes": "ملاحظات خاصة بالمنصة"
}`;
}

/**
 * Structured output schema for Manus content generation.
 */
export const CONTENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "Ad headline" },
    body: { type: "string", description: "Main ad copy text" },
    cta: { type: "string", description: "Call to action text" },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "Relevant hashtags",
    },
    image_description: {
      type: "string",
      description: "Image description in English for image generation",
    },
    platform_notes: {
      type: "string",
      description: "Platform-specific notes",
    },
    video_script: {
      type: "object",
      properties: {
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scene_number: { type: "number" },
              duration_seconds: { type: "number" },
              visual_description: { type: "string" },
              voiceover_text: { type: "string" },
              text_overlay: { type: "string" },
            },
          },
        },
        total_duration_seconds: { type: "number" },
        music_suggestion: { type: "string" },
      },
      description: "Video script details (for video/reel content types)",
    },
  },
  required: ["headline", "body", "cta"],
};
