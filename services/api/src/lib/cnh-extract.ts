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

function resolveProvider(): AiProvider | null {
  const forced = process.env.CNH_AI_PROVIDER?.toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
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

async function extractWithGemini(base64: string, mime: string): Promise<CnhExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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
    throw new Error(`Gemini: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini retornou resposta vazia");
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
    throw new Error(`OpenAI: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou resposta vazia");
  return parseJsonContent(content);
}

export async function extractCnhFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<CnhExtractResult> {
  const provider = resolveProvider();
  if (!provider) {
    return {
      message:
        "Configure GEMINI_API_KEY ou OPENAI_API_KEY no Railway (serviço api). Recomendado: Gemini (grátis no AI Studio).",
    };
  }

  const { dataUrl, base64, mime } = normalizeBase64(imageBase64, mimeType);

  if (mime === "application/pdf" && provider === "openai") {
    return {
      message:
        "PDF da CNH digital requer Gemini (GEMINI_API_KEY). Ou envie captura em JPEG/PNG.",
    };
  }

  if (provider === "gemini") {
    return extractWithGemini(base64, mime);
  }
  return extractWithOpenAI(dataUrl);
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
