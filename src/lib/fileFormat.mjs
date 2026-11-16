// Use the attachment filename rather than its temporary download URL.
export function fileFormat(filename) {
  if (typeof filename !== "string") return "FILE";
  const basename = filename.trim().split(/[\\/]/).pop();
  const match = basename.match(/^.+\.([a-z0-9]{1,12})$/i);
  return match ? match[1].toUpperCase() : "FILE";
}

export function canPreviewFile(filename) {
  return ["PDF", "PNG", "JPG", "JPEG", "SVG", "WEBP", "GIF", "AVIF"].includes(fileFormat(filename));
}
