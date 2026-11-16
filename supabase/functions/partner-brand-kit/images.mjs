// Check file signatures independently of the browser-supplied MIME type.
export function isBrandImage(binary, contentType) {
  const bytes = Array.from(binary.slice(0, 12), char => char.charCodeAt(0));
  if (contentType === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (contentType === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (contentType !== "image/svg+xml") return false;
  const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  // SVG must be an SVG document, not HTML or an arbitrary XML file.
  const document = text.replace(/^\uFEFF/, "").trim().replace(/^<\?xml\s[^?]*\?>\s*/i, "").replace(/^(?:<!--[\s\S]*?-->\s*)*/, "");
  // Reject active SVG content and external resources in uploaded branding.
  if (/<!DOCTYPE|<!ENTITY|<\s*(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed|animate\w*|set)\b|\bon[\w-]+\s*=|<\?xml-stylesheet|@import|url\s*\(/i.test(text)) return false;
  if (/\b(?:href|src)\s*=\s*["']\s*(?!#)[^"']+/i.test(text)) return false;
  return /^<svg\b[^>]*\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["'][^>]*(?:\/\s*>|>[\s\S]*<\/svg\s*>)\s*$/i.test(document);
}
