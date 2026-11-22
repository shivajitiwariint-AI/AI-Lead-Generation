/**
 * Helpers for email attachments stored in `Message.meta.attachments`.
 *
 * Two kinds of attachment are supported:
 *  - a public link (`url`) which is also listed in the email body, and
 *  - an uploaded file (`content`, base64) delivered as a real attachment.
 *
 * Base64 content is never sent back to the browser. The UI receives the
 * attachment name/size/type only, and PATCH requests merge the stored content
 * back in by matching attachment names.
 */

export interface EmailAttachment {
  name: string;
  url?: string;
  content?: string;
  mimeType?: string;
  size?: number;
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 2;
/** Base64 inflates bytes by ~4/3, plus a little headroom. */
export const MAX_UPLOAD_BASE64_CHARS = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 1024;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, max = 2000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Coerce stored metadata into a safe list of attachments. */
export function getAttachments(value: unknown): EmailAttachment[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const result: EmailAttachment[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const name = cleanString(raw.name, 200);
    if (!name) continue;
    const url = cleanString(raw.url, 2000);
    const fileNameOnly = !url;
    if (fileNameOnly) {
      if (typeof raw.content !== "string") continue;
      const content = raw.content.trim();
      // Do not truncate file bytes — a partial file would be corrupt.
      if (!content || content.length > MAX_UPLOAD_BASE64_CHARS) continue;
      result.push({
        name,
        content,
        mimeType: cleanString(raw.mimeType, 200) ?? "application/octet-stream",
        size:
          typeof raw.size === "number" && Number.isFinite(raw.size) && raw.size >= 0
            ? Math.min(Math.round(raw.size), MAX_UPLOAD_BYTES)
            : undefined,
      });
    } else {
      result.push({ name, url });
    }
  }
  return result;
}

/** Remove uploaded file bytes before returning an email to the browser. */
export function sanitizeAttachments(value: unknown): EmailAttachment[] {
  return getAttachments(value).map((attachment) =>
    attachment.url
      ? { name: attachment.name, url: attachment.url }
      : {
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
        }
  );
}

/** Return a message object with any base64 attachment content stripped. */
export function sanitizeMessageForClient<T extends { meta?: unknown }>(message: T): T {
  const meta = isRecord(message.meta) ? message.meta : null;
  if (!meta || !("attachments" in meta)) return message;
  return {
    ...message,
    meta: { ...meta, attachments: sanitizeAttachments(meta.attachments) },
  } as T;
}

/**
 * Merge incoming attachment metadata with what is already stored.
 * The browser only knows names for previously uploaded files, so their
 * base64 content is copied over from the existing record.
 */
export function mergeAttachments(value: unknown, incoming: unknown): EmailAttachment[] {
  const prior = getAttachments(value);
  const list: unknown[] = Array.isArray(incoming) ? incoming : [];

  return list.flatMap((raw): EmailAttachment[] => {
    if (!isRecord(raw)) return [];
    const name = cleanString(raw.name, 200);
    if (!name) return [];

    if (typeof raw.content === "string" && raw.content.trim()) {
      return [
        {
          name,
          content: raw.content.trim(),
          mimeType: cleanString(raw.mimeType, 200) ?? "application/octet-stream",
          size:
            typeof raw.size === "number" && Number.isFinite(raw.size)
              ? Math.max(0, Math.round(raw.size))
              : undefined,
        },
      ];
    }

    const url = cleanString(raw.url, 2000);
    if (url) return [{ name, url }];

    // No link and no bytes from the browser: reuse the stored upload.
    const stored = prior.find((item) => item.name === name && !item.url);
    if (stored?.content) {
      return [
        {
          name,
          content: stored.content,
          mimeType: cleanString(raw.mimeType, 200) ?? stored.mimeType,
          size:
            typeof raw.size === "number" && Number.isFinite(raw.size) ? raw.size : stored.size,
        },
      ];
    }
    return [];
  });
}

/** Validate size/count limits after merging. Returns an error message or null. */
export function validateAttachments(attachments: EmailAttachment[]): string | null {
  const uploads = attachments.filter((attachment) => !attachment.url);
  if (uploads.length > MAX_UPLOAD_FILES) {
    return `You can attach up to ${MAX_UPLOAD_FILES} uploaded files`;
  }
  for (const upload of uploads) {
    if (!upload.content) return `“${upload.name}” is missing its file data — please re-upload it`;
    const bytes = estimateBase64Bytes(upload.content);
    if (bytes > MAX_UPLOAD_BYTES) return `“${upload.name}” is larger than 2 MB`;
  }
  return null;
}

export function estimateBase64Bytes(content: string): number {
  const clean = content.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** Nodemailer attachment objects for uploaded files only. */
export function toNodemailerAttachments(value: unknown) {
  return getAttachments(value)
    .filter((attachment) => !attachment.url && attachment.content)
    .map((attachment) => ({
      filename: attachment.name,
      content: Buffer.from(attachment.content as string, "base64"),
      contentType: attachment.mimeType ?? "application/octet-stream",
    }));
}

/** Resend attachment objects for uploaded files only. */
export function toResendAttachments(value: unknown) {
  return getAttachments(value)
    .filter((attachment) => !attachment.url && attachment.content)
    .map((attachment) => ({
      filename: attachment.name,
      content: attachment.content as string,
      contentType: attachment.mimeType ?? "application/octet-stream",
    }));
}
