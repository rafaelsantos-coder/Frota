import type { CnhPhotoBox } from "@frota/shared";

/** Região típica da foto 3x4 na CNH brasileira (frente) */
export const DEFAULT_CNH_PHOTO_BOX: CnhPhotoBox = {
  left: 0.03,
  top: 0.18,
  width: 0.26,
  height: 0.55,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePhotoBox(box?: Partial<CnhPhotoBox> | null): CnhPhotoBox {
  if (!box) return DEFAULT_CNH_PHOTO_BOX;
  return {
    left: clamp(Number(box.left) || DEFAULT_CNH_PHOTO_BOX.left, 0, 0.75),
    top: clamp(Number(box.top) || DEFAULT_CNH_PHOTO_BOX.top, 0, 0.75),
    width: clamp(Number(box.width) || DEFAULT_CNH_PHOTO_BOX.width, 0.08, 0.45),
    height: clamp(Number(box.height) || DEFAULT_CNH_PHOTO_BOX.height, 0.08, 0.75),
  };
}

function cropCanvasToJpeg(canvas: HTMLCanvasElement, box: CnhPhotoBox): string {
  const sx = Math.round(box.left * canvas.width);
  const sy = Math.round(box.top * canvas.height);
  const sw = Math.max(1, Math.round(box.width * canvas.width));
  const sh = Math.max(1, Math.round(box.height * canvas.height));

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/jpeg", 0.92);
}

async function renderImageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

async function renderPdfFirstPageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const bytes = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function renderDocumentToCanvas(file: File): Promise<HTMLCanvasElement> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return renderPdfFirstPageToCanvas(file);
  return renderImageFileToCanvas(file);
}

/** Recorta a foto 3x4 da CNH a partir do arquivo enviado */
export async function extractPhotoFromCnhDocument(
  file: File,
  photoBox?: Partial<CnhPhotoBox> | null,
): Promise<string> {
  const box = normalizePhotoBox(photoBox);
  const canvas = await renderDocumentToCanvas(file);
  return cropCanvasToJpeg(canvas, box);
}
