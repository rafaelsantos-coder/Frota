import type { CnhExtractResult } from "@frota/shared";

const EXTRACT_PROMPT = `Você analisa documentos brasileiros de CNH (Carteira Nacional de Habilitação), incluindo CNH digital em PDF ou foto da carteira física.

Extraia os dados e retorne APENAS um JSON válido com estas chaves (omitir se não encontrar):
{
  "name": "nome completo",
  "cpf": "apenas números ou formatado",
  "rg": "número do documento de identidade se visível",
  "cnh": "número de registro da CNH",
  "birthDate": "YYYY-MM-DD",
  "cnhExpiry": "YYYY-MM-DD data de validade",
  "photoBox": {
    "left": 0.05,
    "top": 0.20,
    "width": 0.22,
    "height": 0.48
  }
}

O campo photoBox deve delimitar APENAS a foto 3x4 do condutor na CNH (retrato), em coordenadas normalizadas de 0 a 1 em relação à largura e altura totais do documento/página.

Use formato de data ISO. Para CPF mantenha pontuação se visível no documento.`;

type AiProvider = "gemini" | "openai";

class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function resolveProviderOrder(): AiProvider[] {
  const forced = process.env.CNH_AI_PROVIDER?.toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

  if (forced === "openai" && hasOpenAi) return ["openai"];
  if (forced === "gemini" && hasGemini) return ["gemini"];
  if (hasGemini && hasOpenAi) return ["gemini", "openai"];
  if (hasGemini) return ["gemini"];
  if (hasOpenAi) return ["openai"];
  return [];
}

function normalizeBase64(imageBase64: string, mimeType: string) {
  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : imageBase64;
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? mimeType;
  return { dataUrl, base64, mime };
}

function parseJsonContent(text: string): CnhExtractResult {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const json = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(json) as CnhExtractResult;
}

function geminiModels(): string[] {
  const preferred = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";
  return [...new Set([preferred, "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"])];
}

function friendlyProviderError(provider: AiProvider, status: number, raw: string): AiProviderError {
  if (status === 429) {
    return new AiProviderError(
      "Cota da IA esgotada (limite diário). Gere uma nova chave em aistudio.google.com/apikey, atualize GEMINI_API_KEY no Railway, ou preencha os campos manualmente.",
      429,
      true,
    );
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(
      provider === "gemini"
        ? "Chave Gemini inválida. Gere uma nova chave em aistudio.google.com/apikey e atualize GEMINI_API_KEY no Railway."
        : "Chave OpenAI inválida. Verifique OPENAI_API_KEY no Railway.",
      status,
    );
  }
  return new AiProviderError(
    `${provider === "gemini" ? "Gemini" : "OpenAI"} indisponível (${status}). Tente novamente ou preencha manualmente.`,
    status,
    status >= 500,
  );
}

async function extractWithGemini(
  base64: string,
  mime: string,
  model: string,
): Promise<CnhExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: EXTRACT_PROMPT },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw friendlyProviderError("gemini", response.status, errText);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiProviderError("Gemini retornou resposta vazia", undefined, true);
  return parseJsonContent(text);
}

async function extractWithOpenAI(dataUrl: string): Promise<CnhExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw friendlyProviderError("openai", response.status, errText);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiProviderError("OpenAI retornou resposta vazia", undefined, true);
  return parseJsonContent(content);
}

async function tryGemini(base64: string, mime: string): Promise<CnhExtractResult> {
  let lastError: AiProviderError | null = null;
  for (const model of geminiModels()) {
    try {
      return await extractWithGemini(base64, mime, model);
    } catch (error) {
      if (error instanceof AiProviderError) {
        lastError = error;
        if (error.status === 429) break;
        if (!error.retryable) throw error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new AiProviderError("Gemini indisponível", undefined, true);
}

export async function extractCnhFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<CnhExtractResult> {
  const providers = resolveProviderOrder();
  if (providers.length === 0) {
    return {
      message:
        "Configure GEMINI_API_KEY ou OPENAI_API_KEY no Railway (serviço api). Recomendado: Gemini (grátis no AI Studio).",
    };
  }

  const { dataUrl, base64, mime } = normalizeBase64(imageBase64, mimeType);
  const errors: string[] = [];

  for (const provider of providers) {
    if (provider === "openai" && mime === "application/pdf") {
      errors.push("OpenAI não lê PDF — use Gemini ou envie captura JPEG/PNG da CNH.");
      continue;
    }

    try {
      if (provider === "gemini") {
        return await tryGemini(base64, mime);
      }
      return await extractWithOpenAI(dataUrl);
    } catch (error) {
      const message =
        error instanceof AiProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Erro na extração";
      errors.push(message);
    }
  }

  return {
    message:
      errors[0] ??
      "Não foi possível extrair a CNH com IA. Preencha os campos manualmente ou tente captura em JPEG/PNG.",
  };
}

export function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
