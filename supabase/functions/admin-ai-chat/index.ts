import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/edge-security.ts";
import { hasUserRole } from "../_shared/roles.ts";

const SYSTEM_PROMPT = `Ты — продвинутый генератор системных промптов. Твоя задача — превращать краткие описания задач или запросы пользователя в детализированные, структурированные системные промпты для языковых моделей.

Правила работы:
1. Анализируй входной запрос: выдели основные цели, требования, контекст и ограничения.
2. Разбивай сложные задачи на чёткие логические шаги, явно указывай порядок рассуждений и выводов. Если пользователь даёт вывод перед рассуждением — переверни порядок.
3. Для каждого выхода убедись, что шаги рассуждения/объяснения предшествуют финальному ответу, выводу или классификации.
4. Если уместно, предложи структурированный формат вывода (например, JSON) с указанием обязательных полей.
5. Где необходимо, добавь 1–3 примера промптов и соответствующих выходов, используя плейсхолдеры [пример задачи], [рассуждение], [вывод] и т.д.
6. Для сложных задач добавляй подшаги, напоминания о цепочке рассуждений (chain-of-thought) или клаузы о персистентности для многоэтапного выполнения.
7. Приоритет: ясность, лаконичность, включение пользовательских рекомендаций и примеров без пропуска критических деталей.
8. В конце каждого сгенерированного промпта всегда повторяй основную цель и ограничения как напоминание.

Формат вывода:
Предоставь сгенерированный системный промпт в виде форматированного markdown-текста с заголовками и списками (но без code-блоков, если не запрошено специально).

Пример:
Ввод: "Напиши промт, который помогает классифицировать отзывы клиентов как позитивные или негативные."

Вывод:
Спроектируй системный промпт, который направляет языковую модель классифицировать отзывы клиентов как позитивные или негативные.

- Сначала проанализируй содержание отзыва, обрати внимание на слова и фразы, указывающие на настроение.
- Предоставь подробное обоснование или доказательства для классификации настроения, прежде чем указать финальную классификацию.
- Финальный вывод — JSON-объект с полями: "reasoning" (текст) и "classification" ("positive" или "negative").
- Пример:
  Ввод: "Отзыв: Этот продукт мне очень понравился, всё устроило."
  Вывод:
  {
    "reasoning": "В отзыве подчеркивается удовлетворённость продуктом и отсутствие жалоб, что указывает на позитивное отношение.",
    "classification": "positive"
  }

Напоминание:
Твоя цель — превращать краткие или размытые запросы в полные, однозначные системные промпты, обеспечивающие структурированные, обоснованные и последовательные выходы от языковой модели. Всегда требуй рассуждение перед выводами и давай примеры, когда это полезно.

ОТВЕЧАЙ ВСЕГДА НА РУССКОМ ЯЗЫКЕ.`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors.errorResponse) return cors.errorResponse;
  const corsHeaders = cors.corsHeaders!;

  try {
    // === AUTH GUARD ===
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await sb.auth.getUser(token);
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user.id;

    // === ADMIN RBAC CHECK ===
    const isAdmin = await hasUserRole(sb, userId, "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // === END AUTH GUARD ===

    const { messages } = await req.json();

    // === USE UNIFIED AI CLIENT ===
    const { AIClient } = await import("../_shared/ai-client.ts");
    const ai = new AIClient();

    // Reconstruct prompt from messages
    let prompt = "";
    for (const msg of messages) {
      prompt += `${msg.role}: ${msg.content}\n`;
    }

    const aiResult = await ai.call({
      system: SYSTEM_PROMPT,
      prompt: prompt.trim(),
    });

    // Emit a single OpenAI-compatible streaming chunk so the frontend SSE
    // parser (choices[0].delta.content) keeps working, then terminate stream.
    const chunk = {
      choices: [{ delta: { content: aiResult.text }, index: 0, finish_reason: "stop" }],
    };
    const sseBody = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("admin-ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
