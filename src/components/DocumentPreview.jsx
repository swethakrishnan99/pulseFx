import { useEffect, useState } from "react";
import { fileFormat } from "../lib/fileFormat.mjs";

function PdfPreview({ file, name }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    async function load() {
      try {
        const response = await fetch(file.url, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load the PDF. Close the preview and try again.");
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("This attachment could not be read as a PDF.");
        // Ignore the attachment server's download headers; use a validated PDF blob.
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setPreview({ source: file.url, url: objectUrl });
      } catch (error) {
        if (!controller.signal.aborted) setPreview({ source: file.url, error: error.message });
      }
    }
    load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.url]);
  if (preview?.source !== file.url) return <p aria-live="polite" className="flex h-64 items-center justify-center text-sm text-gray-500">Loading PDF preview…</p>;
  if (preview.error) return <p role="alert" className="rounded-lg border border-gray-200 p-6 text-sm text-danger">{preview.error} You can still try downloading the file.</p>;
  return <div className="space-y-3">
    {/* A sandboxed iframe blocks native PDF viewers. Only embed our validated PDF blob. */}
    <iframe title={name} src={preview.url} className="h-[60vh] w-full rounded-lg border border-gray-200" />
    <p className="text-xs text-gray-500">Preview not displaying? <a href={preview.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">Open PDF in a new tab</a>.</p>
  </div>;
}
export default function DocumentPreview({ file, name }) {
  const format = fileFormat(file.name);
  if (["PNG", "JPG", "JPEG", "SVG", "WEBP", "GIF", "AVIF"].includes(format)) return <div className={`flex min-h-64 items-center justify-center rounded-xl p-6 ${/white/i.test(file.name) ? "bg-navy" : "bg-gray-100"}`}><img src={file.url} alt={name} className="max-h-96 max-w-full object-contain" /></div>;
  if (format === "PDF") return <PdfPreview key={file.url} file={file} name={name} />;
  return <p className="text-sm text-gray-500">Preview is unavailable for this format. Download the file to open it.</p>;
}
