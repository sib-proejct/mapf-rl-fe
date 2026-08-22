/**
 * Identifier formatting and clipboard helper.
 */

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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
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
  } catch {
    return false;
  }
}
