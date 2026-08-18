export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv"
]);

const ALLOWED_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv"
]);

export function extensionOf(filename: string): string {
  const match = /\.[a-z0-9]+$/i.exec(filename.trim());
  return match ? match[0].toLowerCase() : "";
}

export function decodeFileData(raw: unknown): Buffer | null {
  const value = String(raw || "").trim();
  if (!value) {
    return null;
  }
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  try {
    const buffer = Buffer.from(base64, "base64");
    return buffer.length ? buffer : null;
  } catch {
    return null;
  }
}

export function validateFile(filename: string, mimeType: string, size: number): string | null {
  const ext = extensionOf(filename);
  const mime = String(mimeType || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(mime)) {
    return "Use a PDF, image, Word, Excel, or text file.";
  }
  if (size > MAX_FILE_BYTES) {
    return "Files must be 4 MB or smaller.";
  }
  return null;
}

export function safeFilename(name: string): string {
  const cleaned = name.replace(/[\r\n"]/g, "_").trim();
  return cleaned.slice(0, 180) || "document";
}

export function fileBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  return Buffer.from(value as Uint8Array);
}
