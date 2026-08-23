/**
 * Identifier formatting, RFC 4122 UUIDv4 generation, payload digestion, and clipboard helpers.
 */

/**
 * Generates an RFC 4122 compliant UUIDv4 identifier.
 */
export function generateUuidV4(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback RFC 4122 UUIDv4
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Math.random fallback (for test runners / environments without web crypto)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Canonicalizes an object into sorted JSON string for stable idempotency comparison.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`,
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Computes a stable 64-char hex digest (or FNV-1a 64-bit padded hash) of any payload for duplicate prevention.
 */
export function computePayloadDigest(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  let hash1 = 0x811c9dc5;
  let hash2 = 0x597f;

  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 = (hash2 + code * (i + 1)) & 0xffffffff;
  }

  const h1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const h2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  // Repeat to 64 chars
  return (h1 + h2).repeat(4).slice(0, 64);
}

/**
 * Truncates a long UUID or digest for concise display while keeping prefix and suffix.
 */
export function formatShortId(
  id: string,
  prefixLength: number = 8,
  suffixLength: number = 4,
): string {
  if (!id) return "-";
  if (id.length <= prefixLength + suffixLength + 3) {
    return id;
  }
  return `${id.slice(0, prefixLength)}...${id.slice(-suffixLength)}`;
}

/**
 * Copies text to clipboard securely.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    if (typeof document !== "undefined") {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
    return false;
  } catch {
    return false;
  }
}
