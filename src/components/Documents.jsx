import SortableHeader from "./SortableHeader";
import useTableSort from "../lib/useTableSort";
import ActionButton from "./ActionButton";
import { dialogDanger, dialogInput, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import DocumentPreview from "./DocumentPreview";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Info, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import PortalDialog from "./PortalDialog";
import { documentsRequest, documentSnapshot } from "../lib/documents";
import { encodeBrandFile } from "../lib/brandKit";
import { canPreviewFile, fileFormat } from "../lib/fileFormat.mjs";
import { formatAirtableDateTime } from "../lib/airtableDates.mjs";
const button = dialogSecondary;
const primary = dialogPrimary;
const input = dialogInput;
const actionClass = "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const sections = [["brand", "Brand assets", "Logos and brand materials for partners to use when representing PulseFX."], ["guide", "Partner guide", "Product overviews and service guides for partners to share with clients."]];
function AuditDetails({ label, value, showActor = true }) {
  return <section className="rounded-lg border border-gray-100 p-4"><h3 className="text-sm font-semibold text-gray-900">{label}</h3><dl className="mt-3 space-y-3">
    {[["Date and time", value.at ? formatAirtableDateTime(value.at) : "—"], ...(showActor ? [["Email", value.email || "—"], ["Supabase user ID", value.userId || "—"]] : [])].map(([title, detail]) => <div key={title}><dt className="text-xs text-gray-500">{title}</dt><dd className={`mt-1 break-all text-sm ${title === "Supabase user ID" ? "font-mono text-xs" : ""}`}>{detail}</dd></div>)}
  </dl></section>;
}
function DocumentSection({ section, label, description, showDeleted }) {
  const { sort, toggleSort, sortRows } = useTableSort();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [informationId, setInformationId] = useState(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [filename, setFilename] = useState("");
  const [visible, setVisible] = useState(false);
  const saving = useRef(false);
  const preparing = useRef(false);
  useEffect(() => {
    let active = true;
    documentsRequest({ action: "load", section }).then(data => {
      if (active) { setDocuments(data.documents); setError(""); setUncertain(false); }
    }).catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, revision]);
  function refresh() { setLoading(true); setModal(null); setRevision(value => value + 1); }
  function open(action, document = null) { setError(""); setName(document?.name || ""); setFilename(document?.file?.name || ""); setFile(null); setVisible(false); setModal({ action, document }); }
  async function mutate(body) {
    if (saving.current || uncertain) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const result = await documentsRequest({ ...body, section });
      setDocuments(rows => body.action === "create" ? [...rows, result.document] : rows.map(row => row.id === result.document.id ? result.document : row));
      setModal(null);
    } catch (error) { setError(error.message); if (error.uncertain) setUncertain(true); }
    finally { saving.current = false; setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (saving.current || preparing.current || uncertain) return;
    preparing.current = true; setBusy(true);
    try {
      const body = { action: modal.action };
      if (modal.document) Object.assign(body, { id: modal.document.id, expected: documentSnapshot(modal.document) });
      if (["create", "replace"].includes(modal.action)) {
        if (!file || file.size === 0 || file.size > 5 * 1024 * 1024) { setError("Choose a non-empty file up to 5 MB."); return; }
        Object.assign(body, { filename: file.name, file: await encodeBrandFile(file) });
      }
      if (modal.action === "create") Object.assign(body, { name: name.trim(), visible });
      if (modal.action === "edit") Object.assign(body, { name: name.trim(), filename: filename.trim() });
      await mutate(body);
    } catch (error) { setError(error.message); }
    finally { preparing.current = false; setBusy(false); }
  }
  async function readFile(document, download = false) {
    if (saving.current || (!download && !canPreviewFile(document.file?.name))) return;
    saving.current = true; setBusy(true); setError("");
    try {
      // Refresh expiring Airtable URLs. Archived files remain readable by administrators.
      const { documents: latest } = await documentsRequest({ action: "load", section });
      setDocuments(latest);
      const current = latest.find(row => row.id === document.id);
      if (!current?.file) throw new Error("This document is no longer available.");
      if (!download) {
        if (!canPreviewFile(current.file.name)) throw new Error("Preview is available only for PDF and images.");
        setPreview(current); return;
      }
      const response = await fetch(current.file.url);
      if (!response.ok) throw new Error("Unable to download this file.");
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a"); link.href = url; link.download = current.file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
    finally { saving.current = false; setBusy(false); }
  }
  const information = documents.find(row => row.id === informationId);
  const rows = sortRows(documents.filter(row => row.deleted === showDeleted), {
    created: { value: row => row.created.at, type: "date" },
    updatedAt: { type: "date" },
    replaced: { value: row => row.replaced.at, type: "date" },
    deletedAt: { value: row => row.deletedAudit.at, type: "date" },
  });
  const disabled = busy || loading || uncertain;
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
      <div><h2 className="font-semibold text-accent">{label}</h2><p className="mt-1 text-xs text-gray-500">{description}</p></div>
      <div className="flex flex-wrap items-center gap-2"><button className={button} type="button" disabled={busy || loading} onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button><button className={primary} type="button" disabled={disabled} onClick={() => open("create")}><Plus className="h-4 w-4" />Add file</button></div>
    </div>
    {error && !modal && <p role="alert" className="px-5 py-3 text-sm text-danger">{error}</p>}
    {loading ? <p className="p-5 text-sm text-gray-500">Loading documents…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{[["name", "Document"], ["visible", "Visible to partner"], ["created", "Created"], ["updatedAt", "Last updated"], ["replaced", "Last replaced"], ["deletedAt", "Deleted at"]].map(([key, title]) => <SortableHeader key={key} column={key} label={title} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-5 py-3 font-medium" />)}<th scope="col" className="px-5 py-3 font-medium">Actions</th></tr></thead>
      <tbody className="divide-y divide-gray-100">{rows.map(row => <tr key={row.id}>
        <td className="min-w-48 max-w-72 px-5 py-3"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium text-gray-900" title={row.name}>{row.name}</span><span className="shrink-0 text-xs text-gray-400">{fileFormat(row.file?.name)}</span>{row.deleted && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger"><Trash2 className="h-3 w-3" aria-hidden="true" />Deleted</span>}</div></td>
        <td className="px-5 py-4"><input type="checkbox" aria-label={`Visible to partner: ${row.name}`} checked={row.visible} disabled={disabled || row.deleted} onChange={event => mutate({ action: "visibility", id: row.id, expected: documentSnapshot(row), visible: event.target.checked })} /></td>
        <td className="whitespace-nowrap px-5 py-4 align-top text-xs">{row.created.at ? formatAirtableDateTime(row.created.at) : "—"}</td><td className="whitespace-nowrap px-5 py-4 align-top text-xs">{row.updatedAt ? formatAirtableDateTime(row.updatedAt) : "—"}</td><td className="whitespace-nowrap px-5 py-4 align-top text-xs">{row.replaced.at ? formatAirtableDateTime(row.replaced.at) : "—"}</td><td className="whitespace-nowrap px-5 py-4 align-top text-xs">{row.deletedAudit.at ? formatAirtableDateTime(row.deletedAudit.at) : "—"}</td>
        <td className="px-5 py-4"><div className="flex gap-1.5" role="group" aria-label={`Actions for ${row.name}`}>
          <ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-accent`} disabled={busy || !canPreviewFile(row.file?.name)} onClick={() => readFile(row)} label={`View ${row.name}`} tooltip={canPreviewFile(row.file?.name) ? "View document" : "Preview is available only for PDF and images"}><Eye className="h-4 w-4" /></ActionButton>
          {!row.deleted && <ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-accent`} disabled={disabled} onClick={() => open("edit", row)} label={`Edit ${row.name}`} tooltip="Edit document"><Pencil className="h-4 w-4" /></ActionButton>}
          <ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-accent`} disabled={busy || !row.file} onClick={() => readFile(row, true)} label={`Download ${row.name}`} tooltip="Download file"><Download className="h-4 w-4" /></ActionButton>
          {!row.deleted && <><ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-accent`} disabled={disabled} onClick={() => open("replace", row)} label={`Replace ${row.name}`} tooltip="Replace file"><Upload className="h-4 w-4" /></ActionButton>
          <ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-danger`} disabled={disabled} onClick={() => open("delete", row)} label={`Delete ${row.name}`} tooltip="Delete document"><Trash2 className="h-4 w-4" /></ActionButton></>}
          <ActionButton className={`${actionClass} text-gray-500 enabled:hover:text-accent`} disabled={busy} onClick={() => setInformationId(row.id)} label={`Information for ${row.name}`} tooltip="Document information"><Info className="h-4 w-4" /></ActionButton>
        </div></td>
      </tr>)}{!rows.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">{showDeleted ? "No deleted documents." : "No documents yet."}</td></tr>}</tbody></table></div>}
    {modal && <PortalDialog title={modal.action === "create" ? `Add file — ${label}` : modal.action === "replace" ? "Replace file" : modal.action === "edit" ? "Edit document" : "Delete document"} subtitle={modal.document?.name || "Add a name and upload the document."} onClose={() => { if (!busy) setModal(null); }} icon={<FileText className="h-5 w-5" />} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4 p-6" aria-busy={busy}>
        {modal.action === "delete" ? <p className="text-sm text-gray-600">This document will be removed from partner screens and moved to Deleted documents. The file and deletion audit will be retained.</p> : <>
          {["create", "edit"].includes(modal.action) && <label className="block text-sm font-medium">Document name<input className={`${input} mt-2`} required maxLength={200} value={name} disabled={busy || uncertain} onChange={event => setName(event.target.value)} /></label>}
          {modal.action === "edit" ? <><label className="block text-sm font-medium">File name<input className={`${input} mt-2`} required={!!modal.document.file} maxLength={255} value={filename} disabled={busy || uncertain || !modal.document.file} onChange={event => setFilename(event.target.value)} /></label><p className="text-xs text-gray-500">Keep the existing file extension. The file content stays the same.</p></> : <><label className="block text-sm font-medium">File<input className={`${input} mt-2`} type="file" required disabled={busy || uncertain} accept=".pdf,.png,.jpg,.jpeg,.svg,.webp,.gif,.txt,.csv,.zip,.docx,.xlsx,.pptx" onChange={event => setFile(event.target.files[0] || null)} /></label><p className="text-xs text-gray-500">Maximum 5 MB. PDF, images, Office documents, TXT, CSV or ZIP.</p></>}
          {modal.action === "create" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} disabled={busy || uncertain} onChange={event => setVisible(event.target.checked)} />Visible to partner</label>}
        </>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => uncertain ? refresh() : setModal(null)}>{uncertain ? "Refresh documents" : "Cancel"}</button><button type="submit" className={modal.action === "delete" ? dialogDanger : primary} disabled={busy || uncertain || (["create", "edit"].includes(modal.action) && !name.trim()) || (modal.action === "edit" && (name.trim() === modal.document.name && filename.trim() === (modal.document.file?.name || "")))}>{busy ? "Saving…" : modal.action === "create" ? "Add file" : modal.action === "replace" ? "Replace file" : modal.action === "edit" ? "Save changes" : "Delete document"}</button></div>
      </form>
    </PortalDialog>}
    {information && <PortalDialog title="Document information" subtitle={information.name} icon={<Info className="h-5 w-5" />} maxWidth="max-w-xl" onClose={() => setInformationId(null)}>
      <div className="space-y-4 p-6">
        <dl className="space-y-3 rounded-lg bg-gray-50 p-4">{[["File name", information.file?.name || "—"], ["Visible to partner", information.visible && !information.deleted ? "Yes" : "No"]].map(([title, value]) => <div key={title}><dt className="text-xs text-gray-500">{title}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl>
        <AuditDetails label="Created" value={information.created} />
        <AuditDetails label="Last updated" value={information.updated || { at: information.updatedAt }} />
        <AuditDetails label="Last replaced" value={information.replaced} />
        {(information.deleted || information.deletedAudit.at) && <AuditDetails label="Deleted" value={information.deletedAudit} />}
        <div className="flex justify-end"><button className={button} type="button" onClick={() => setInformationId(null)}>Close</button></div>
      </div>
    </PortalDialog>}
    {preview && <PortalDialog title={preview.name} subtitle={preview.file.name} onClose={() => setPreview(null)} icon={<Eye className="h-5 w-5" />}>
      <div className="space-y-4 p-6"><DocumentPreview file={preview.file} name={preview.name} /><div className="flex justify-end"><button className={button} type="button" disabled={busy} onClick={() => readFile(preview, true)}><Download className="h-4 w-4" />Download</button></div></div>
    </PortalDialog>}
  </section>;
}
export default function Documents() {
  const [showDeleted, setShowDeleted] = useState(false);
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500">Upload documents and control which files partners can see.</p><label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600"><input type="checkbox" className="accent-accent" checked={showDeleted} onChange={event => setShowDeleted(event.target.checked)} />Deleted documents</label></div>{sections.map(([section, label, description]) => <DocumentSection key={section} section={section} label={label} description={description} showDeleted={showDeleted} />)}</div>;
}
