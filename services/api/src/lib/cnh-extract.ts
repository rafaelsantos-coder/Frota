import type { CnhExtractResult } from "@frota/shared";

const EXTRACT_PROMPT = `Você analisa documentos brasileiros de CNH (Carteira Nacional de Habilitação), incluindo CNH digital em PDF convertido para imagem ou foto da carteira física.

Extraia os dados e retorne APENAS um JSON válido com estas chaves (omitir se não encontrar):
{
  "name": "nome completo",
  "cpf": "apenas números ou formatado",
  "rg": "número do documento de identidade se visível",
  "cnh": "número de registro da CNH",
  "birthDate": "YYYY-MM-DD",
  "cnhExpiry": "YYYY-MM-DD data de validade"
}

Use formato de data ISO. Para CPF mantenha pontuação se visível no documento.`;

export async function extractCnhFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<CnhExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      message:
        "OPENAI_API_KEY não configurada no servidor. Preencha os campos manualmente ou configure a chave no Railway.",
    };
  }

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

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
    throw new Error(`Falha na extração IA: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Resposta vazia da IA");
  }

  const parsed = JSON.parse(content) as CnhExtractResult;
  return parsed;
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
