import SortableHeader from "./SortableHeader";
import useTableSort from "../lib/useTableSort";
import ClearFiltersButton from "./ClearFiltersButton";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, CheckCircle2, Clock3, Copy, Eye, KeyRound, Link2, LoaderCircle, Pencil, Play, Power, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { changePartnerAccess, createPartner, deletePartnerUser, editPartnerProfile, generatePartnerInvite, generatePartnerRecovery, listPartners } from "../lib/partnerAdmin";
import { createAdmin, listAdmins, manageAdmin } from "../lib/pulsefxUserAdmin";
import PartnerAccountConfirmation from "./PartnerAccountConfirmation";
import ActionButton from "./ActionButton";
import PartnerEdit from "./PartnerEdit";

const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const badge = { Active: "bg-success-100 text-success", "Awaiting activation": "bg-accent-100 text-accent", "Setup incomplete": "bg-warning-100 text-gray-600", Deactivated: "bg-gray-100 text-gray-500" };
const iconButton = "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

async function listManagedUsers(signal) {
  const [partners, { admins, currentUserId }] = await Promise.all([listPartners(signal), listAdmins(signal)]);
  return { partners, admins, currentUserId };
}

function formatCreatedAt(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "long" }).format(new Date(value));
}

function PartnerDetails({ partner, onClose }) {
  const dialog = useRef(null);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  async function copy(label, value) {
    setCopied("");
    setCopyError("");
    try { await navigator.clipboard.writeText(value); setCopied(label); }
    catch { setCopyError("Copy is unavailable. Select the value and copy it manually."); }
  }
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  const details = [
    ["Contact name", partner.name],
    ["Email address", partner.email, true],
    ...(partner.role === "partner_admin" ? [["Role", "Administrator"]] : [["Company", partner.company]]),
    ["Account status", partner.status],
    ["Supabase ID", partner.supabaseId, true],
    ...(partner.role === "partner_admin" ? [] : [["Airtable ID", partner.airtableId, true]]),
    ["User created", formatCreatedAt(partner.createdAt)],
  ];
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="partner-details-title"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-center justify-between gap-3">
      <h2 id="partner-details-title" className="flex items-center gap-2 text-lg font-semibold"><Eye className="h-5 w-5 text-accent" />User details</h2>
      <button type="button" onClick={onClose} aria-label="Close user details" className="rounded-md p-1.5 hover:bg-gray-100"><X className="h-5 w-5" /></button>
    </div>
    <dl className="mt-5 divide-y divide-gray-100">
      {details.map(([label, value, copyable]) => <div key={label} className="py-3 first:pt-0">
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="mt-1 flex items-start gap-2 text-sm">
          <span className={`min-w-0 select-text break-all ${label.endsWith("ID") ? "font-mono" : ""}`}>{value || "Not available"}</span>
          {copyable && value && <button type="button" onClick={() => copy(label, value)}
            aria-label={`Copy ${label}`} title={copied === label ? "Copied" : `Copy ${label}`}
            className={`${iconButton} -mt-1 text-accent`}>
            {copied === label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>}
        </dd>
      </div>)}
    </dl>
    {copied && <p role="status" className="mt-2 text-xs text-accent">{copied} copied.</p>}
    {copyError && <p role="alert" className="mt-2 text-xs text-danger">{copyError}</p>}
    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4"><button type="button" onClick={onClose} className={secondary}>Close</button></div>
  </dialog>;
}

function InvitationLink({ result, onClose }) {
  const recovery = result.kind === "recovery";
  const dialog = useRef(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  async function copy() {
    setError("");
    try { await navigator.clipboard.writeText(result.link); setCopied(true); }
    catch { setError("Copy is unavailable. Select the link and copy it manually."); }
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="invitation-link-title"
    className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex justify-between items-center gap-3"><h2 id="invitation-link-title" className="text-lg font-semibold">{recovery ? "Password reset link ready" : "Invitation link ready"}</h2><button type="button" aria-label="Close invitation link" onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
    <p className="text-sm text-gray-600 mt-3">{recovery ? "Send this private password reset link directly to the registered email address." : "Copy this private link and send it directly to the contact. No email has been sent."}</p>
    <p className="text-sm mt-3 font-medium break-all">{(result.administrator || result.partner).email}</p>
    <label htmlFor="generated-invite-link" className="block text-xs text-gray-500 mt-4 mb-1.5">{recovery ? "Password reset link" : "Invitation link"}</label>
    <input id="generated-invite-link" readOnly value={result.link} onFocus={(event) => event.target.select()} className={input} />
    <p className="text-xs text-gray-500 mt-2">The link is private, expires and can only be used once. Generate a new link if needed.</p>
    {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
    {copied && <p role="status" className="text-sm text-accent mt-3">Link copied.</p>}
    <div className="flex justify-end gap-2 mt-5"><button type="button" onClick={onClose} className={secondary}>Done</button><button type="button" onClick={copy} className={primary}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy link"}</button></div>
  </dialog>;
}

function AddAdminDialog({ onClose, onCreated }) {
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !confirmed) return;
    submitting.current = true;
    setBusy(true); setError("");
    try { onCreated(await createAdmin({ name: name.trim(), email: email.trim().toLowerCase(), confirmAdmin: confirmed })); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="add-admin-title"
    onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-center justify-between gap-3"><h2 id="add-admin-title" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-accent" />Add admin</h2><button type="button" aria-label="Close add admin" disabled={busy} onClick={onClose} className={iconButton}><X className="h-5 w-5" /></button></div>
    <p className="mt-3 text-sm text-gray-600">Create an administrator with access to the admin portal. Share the generated link so they can set their password.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <div><label htmlFor="add-admin-name" className="mb-1.5 block text-xs font-medium">Name *</label><input id="add-admin-name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={input} /></div>
        <div><label htmlFor="add-admin-email" className="mb-1.5 block text-xs font-medium">Email address *</label><input id="add-admin-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={input} /></div>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-accent" /><span>I confirm this person should have administrator access, including the ability to add other administrators.</span></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" disabled={busy} onClick={onClose} className={secondary}>Cancel</button><button type="submit" disabled={busy || !confirmed} className={primary}><ShieldCheck className="h-4 w-4" />{busy ? "Creating admin…" : "Create admin and generate link"}</button></div>
    </form>
  </dialog>;
}

function InviteDialog({ partners, onClose, onInvite }) {
  const dialog = useRef(null);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    const selectedCompany = company.trim();
    if (!selectedCompany || !name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a partner, contact name and valid email address.");
      return;
    }
    const existing = partners.find((partner) => partner.email.trim().toLowerCase() === normalizedEmail);
    if (existing) {
      const messages = {
        Active: "This email already has an active account. Use the existing partner record.",
        Deactivated: "This email belongs to a deactivated account. Reactivate the existing user in Actions.",
        "Awaiting activation": "This email already has a pending invitation. Generate a new invitation link from Actions.",
        "Setup incomplete": "This email is already registered with incomplete setup. Generate an invitation link from Actions to resume.",
      };
      setError(messages[existing.status] || "This email is already registered. Check the existing partner record.");
      return;
    }
    if (partners.some((partner) => partner.company.trim().toLowerCase() === selectedCompany.toLowerCase())) {
      setError("This partner is already registered. Check the partner list before creating another record.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onInvite({ company: selectedCompany, name: name.trim(), email: normalizedEmail });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} aria-labelledby="invite-title"
      onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-navy/50 max-h-[90vh] overflow-y-auto">
      <div className="flex items-start justify-between border-b border-gray-100 p-5">
        <div><h2 id="invite-title" className="font-semibold text-lg">Add a partner</h2><p className="text-sm text-gray-500 mt-1">Register a partner and invite their contact to the portal.</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close invitation" className="p-1.5 rounded-md hover:bg-gray-100"><X className="w-5 h-5" /></button>
      </div>
      <form onSubmit={submit} className="p-5 space-y-5">
        <fieldset disabled={busy} className="space-y-5">
        <div>
          <label htmlFor="admin-company" className="block text-xs font-medium mb-1.5">Partner name *</label>
          <input id="admin-company" required maxLength={160} value={company} onChange={(event) => setCompany(event.target.value)} className={input} />
        </div>
        <div><label htmlFor="admin-name" className="block text-xs font-medium mb-1.5">Contact name *</label>
          <input id="admin-name" autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={input} /></div>
        <div><label htmlFor="admin-email" className="block text-xs font-medium mb-1.5">Email address *</label>
          <input id="admin-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={input} aria-describedby={error ? "admin-invite-error" : "admin-email-hint"} aria-invalid={!!error} />
          <p id="admin-email-hint" className="mt-1.5 text-xs text-gray-500">You can copy and share the invitation link so the contact can set their own password.</p></div>
        <div className="rounded-lg bg-gray-50 p-3 flex gap-2.5 text-xs text-gray-600"><ShieldCheck className="w-4 h-4 text-accent shrink-0" /><p>This invitation grants partner access only. The contact will only see data linked to their account.</p></div>
        </fieldset>
        {error && <p id="admin-invite-error" role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" className={secondary} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy} className={primary}><Link2 className="w-4 h-4" />{busy ? "Generating link…" : "Confirm and generate link"}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function PartnerAdmin() {
  const { sort, toggleSort, sortRows } = useTableSort();
  const [partners, setPartners] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activeList, setActiveList] = useState("partners");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [inviting, setInviting] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [busyLinkKind, setBusyLinkKind] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    listManagedUsers(controller.signal).then((data) => {
      if (!controller.signal.aborted) { setPartners(data.partners); setAdmins(data.admins); setCurrentUserId(data.currentUserId); setError(""); }
    }).catch(() => {
      if (!controller.signal.aborted) setError("Unable to load users. Check the administration setup and try again.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try { const data = await listManagedUsers(); setPartners(data.partners); setAdmins(data.admins); setCurrentUserId(data.currentUserId); setEditing((previous) => previous ? data.partners.find((row) => row.id === previous.id) || null : null); setViewing((previous) => previous ? [...data.partners, ...data.admins].find((row) => row.id === previous.id) || null : null); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }

  const showingAdmins = activeList === "admins";
  const users = showingAdmins ? admins : partners;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = sortRows(users.filter((partner) => (status === "All statuses" || partner.status === status)
    && [partner.company, partner.name, partner.email].some((value) => (value || "").toLowerCase().includes(normalizedQuery))), { identity: (row) => showingAdmins ? row.name : row.company, contact: (row) => showingAdmins ? row.email : row.name });
  const stats = [
    { label: showingAdmins ? "Administrators" : "Partner contacts", value: users.length, icon: showingAdmins ? ShieldCheck : Users },
    { label: "Active accounts", value: users.filter((partner) => partner.status === "Active").length, icon: CheckCircle2 },
    { label: "Pending invitations", value: users.filter((partner) => partner.status === "Awaiting activation").length, icon: Clock3 },
  ];

  async function invite(partner) {
    let result;
    try {
      result = await createPartner(partner);
    } catch (failure) {
      await refresh();
      throw failure;
    }
    setPartners((previous) => [result.partner, ...previous.filter((item) => item.id !== result.partner.id)]);
    setQuery("");
    setStatus("All statuses");
    setInviting(false);
    setActiveList("partners");
    setInvitation(result);
  }

  async function saveEdit(details) {
    setBusyId(details.id); setNotice("");
    try {
      if (editing?.role === "partner_admin") {
        const result = await manageAdmin("edit", details);
        setAdmins((previous) => previous.map((item) => item.id === result.administrator.id ? result.administrator : item));
        setEditing(null);
        setNotice(result.emailChanged ? `Administrator updated. The user must sign in with ${result.administrator.email}.` : "Administrator details updated.");
        return;
      }
      const result = await editPartnerProfile(details);
      setPartners((previous) => previous.map((item) => item.id === result.partner.id ? result.partner : item));
      setEditing(null);
      setNotice(result.emailChanged ? `Partner updated. The user must sign in with ${result.partner.email}.${result.newInvitationRequired ? " Generate a new invitation link to complete activation." : ""}` : "Partner details updated.");
    } catch (failure) {
      await refresh();
      throw failure;
    } finally { setBusyId(null); }
  }

  async function generate(partner, kind = "invite") {
    if (busyId || (kind === "recovery" ? partner.status !== "Active" : ["Active", "Deactivated"].includes(partner.status))) return;
    setBusyId(partner.id);
    setBusyLinkKind(kind);
    setError("");
    setNotice("");
    // Reserve clipboard access during the click for browsers requiring a gesture.
    let resolveLink;
    let rejectLink;
    const linkReady = new Promise((resolve, reject) => { resolveLink = resolve; rejectLink = reject; });
    linkReady.catch(() => {});
    const linkBlob = linkReady.then((link) => new Blob([link], { type: "text/plain" }));
    linkBlob.catch(() => {});
    let clipboard = Promise.resolve(false);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        clipboard = navigator.clipboard.write([new ClipboardItem({ "text/plain": linkBlob })]).then(() => true, () => false);
      }
    } catch { /* The link dialog provides a manual copy fallback. */ }
    try {
      const result = partner.role === "partner_admin" ? await manageAdmin(kind, { id: partner.id }) : kind === "recovery" ? await generatePartnerRecovery(partner.id) : await generatePartnerInvite(partner.id);
      resolveLink(result.link);
      if (result.administrator) setAdmins((previous) => previous.map((item) => item.id === result.administrator.id ? result.administrator : item));
      else setPartners((previous) => previous.map((item) => item.id === result.partner.id ? result.partner : item));
      if (await clipboard) setNotice(`${kind === "recovery" ? "Password reset" : "Invitation"} link copied for ${partner.email}.`);
      else setInvitation(result);
    } catch (failure) { rejectLink(failure); setError(failure.message); }
    finally { setBusyId(null); setBusyLinkKind(null); }
  }

  async function changeAccount(partner, action) {
    if (busyId) return;
    setBusyId(partner.id);
    setNotice("");
    try {
      if (partner.role === "partner_admin") {
        const result = await manageAdmin(action, { id: partner.id });
        setAdmins((previous) => action === "delete" ? previous.filter((item) => item.id !== partner.id) : previous.map((item) => item.id === result.administrator.id ? result.administrator : item));
        setNotice(`Administrator ${partner.email} ${action === "delete" ? "deleted" : action === "enable" ? "reactivated" : "deactivated"}.`);
        setConfirmation(null);
        return;
      }
      if (action === "delete") {
        await deletePartnerUser(partner.id);
        setPartners((previous) => previous.filter((item) => item.id !== partner.id));
        setNotice(`User ${partner.email} deleted.`);
      } else {
        const updated = await changePartnerAccess(partner.id, action === "enable");
        setPartners((previous) => previous.map((item) => item.id === updated.id ? updated : item));
        setNotice(`User ${partner.email} ${action === "enable" ? "reactivated" : "deactivated"}.`);
      }
      setConfirmation(null);
    } catch (failure) {
      await refresh();
      throw failure;
    } finally { setBusyId(null); }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <p className="text-sm text-gray-500">Generate an invitation link and share it directly with the contact.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-lg font-semibold text-gray-900">Users &amp; access</p><p className="text-sm text-gray-500 mt-1">Manage partners, administrators and invitations in one place.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={loading || !!busyId} onClick={refresh}><RefreshCw className="w-4 h-4" />Refresh</button>
        <button type="button" className={primary} disabled={loading || !!busyId} onClick={() => setAddingAdmin(true)}><ShieldCheck className="w-4 h-4" />Add admin</button>
        <button type="button" className={primary} disabled={loading || !!busyId || !!error} onClick={() => setInviting(true)}><UserPlus className="w-4 h-4" />Add partner</button></div>
      </div>
      <nav aria-label="User lists" className="flex gap-1 border-b border-gray-200">
        {[["partners", "Partners", Users], ["admins", "Admins", ShieldCheck]].map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={activeList === key}
          onClick={() => { setActiveList(key); setQuery(""); setStatus("All statuses"); }}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${activeList === key ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
          <Icon className="h-4 w-4" />{label}<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{key === "partners" ? partners.length : admins.length}</span>
        </button>)}
      </nav>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-gray-200/70 bg-white p-5 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold mt-2 text-gray-900">{loading || error ? "—" : value}</p></div>
          <span className="rounded-xl bg-accent-100/60 p-3"><Icon className="w-5 h-5 text-accent" /></span>
        </div>)}
      </div>
      {error && <div role="alert" className="rounded-lg bg-danger-100 p-3 text-sm text-danger flex flex-wrap items-center justify-between gap-3"><p>{error}</p><button type="button" className={secondary} disabled={loading} onClick={refresh}>Try again</button></div>}
      {notice && <div role="status" className="rounded-lg bg-accent-100 p-3 text-sm text-accent flex items-center justify-between gap-3"><p>{notice}</p><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X className="w-4 h-4" /></button></div>}
      <section aria-label={showingAdmins ? "Administrators" : "Partner contacts"} className="rounded-xl border border-gray-200/70 bg-white overflow-hidden">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-0 basis-56"><label htmlFor="admin-search" className="block text-xs text-gray-500 mb-1.5">{showingAdmins ? "Search admin name or email" : "Search partner, name or email"}</label><div className="relative"><Search className="absolute top-3 left-3 w-4 h-4 text-gray-400" /><input id="admin-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`${input} pl-9`} /></div></div>
          <div><label htmlFor="admin-status" className="block text-xs text-gray-500 mb-1.5">Account status</label><select id="admin-status" aria-label="Filter by account status" value={status} onChange={(event) => setStatus(event.target.value)} className={`${input} sm:w-44`}>
            {(showingAdmins ? ["All statuses", "Active", "Awaiting activation", "Deactivated"] : ["All statuses", "Active", "Awaiting activation", "Setup incomplete", "Deactivated"]).map((value) => <option key={value}>{value}</option>)}
          </select></div>
        </div>
        <div className="border-b border-gray-100 px-4 pb-4"><ClearFiltersButton onClick={() => { setQuery(""); setStatus("All statuses"); }} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[880px] table-fixed text-sm text-left">
          <colgroup><col className="w-[26%]" /><col /><col className="w-[190px]" /><col className="w-[240px]" /></colgroup>
          <thead className="bg-gray-50 text-[11px] text-gray-500"><tr>{[["identity", showingAdmins ? "Administrator" : "Partner"], ["contact", showingAdmins ? "Email" : "Contact"], ["status", "Account status"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={toggleSort} className="font-medium px-5 py-3 whitespace-nowrap" />)}<th scope="col" className="font-medium px-5 py-3 whitespace-nowrap">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((partner) => <tr key={partner.id} className="h-[76px] hover:bg-gray-50/50">
              <td className="px-5 py-4 font-medium text-gray-900"><span className="flex items-center gap-2">{showingAdmins ? <ShieldCheck className="w-4 h-4 text-accent shrink-0" /> : <Building2 className="w-4 h-4 text-gray-400 shrink-0" />}<span className="min-w-0 break-words">{showingAdmins ? partner.name || "Administrator" : partner.company}</span></span></td>
              <td className="px-5 py-4">{!showingAdmins && <p className="text-gray-900">{partner.name}</p>}<p className={showingAdmins ? "break-all text-gray-900" : "text-xs text-gray-500 mt-1 break-all"}>{partner.email}</p></td>
              <td className="px-5 py-4"><span className={`inline-flex text-xs rounded-full px-2.5 py-1 whitespace-nowrap ${badge[partner.status]}`}>{partner.status}</span>{partner.profileEditPending && <p className="mt-1 text-xs text-warning">Update pending</p>}{partner.airtableSyncPending && partner.airtableSyncError && <p className="text-[11px] mt-1.5 text-warning">Airtable update pending — retrying</p>}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1.5" role="group" aria-label={`Account actions for ${partner.email}`}>
                  <ActionButton className={`${iconButton} text-accent`} disabled={loading} label={`View user details for ${partner.email}`} tooltip="View user details" onClick={() => setViewing(partner)}><Eye className="w-4 h-4" /></ActionButton>
                  <ActionButton className={`${iconButton} text-blue-600`} disabled={loading || !!busyId || partner.status === "Setup incomplete"} label={`Edit ${showingAdmins ? "admin" : "partner"} ${partner.email}`} tooltip={partner.profileEditPending ? "Resume partner update" : showingAdmins ? "Edit administrator details" : "Edit partner details"} onClick={() => setEditing(partner)}><Pencil className="w-4 h-4" /></ActionButton>
                  <ActionButton className={`${iconButton} text-accent`} disabled={loading || !!busyId || partner.profileEditPending || ["Active", "Deactivated"].includes(partner.status)} tooltip={["Active", "Deactivated"].includes(partner.status) ? "Copy invitation link (available before activation)" : "Copy invitation link"} label={`Copy invitation link for ${partner.email}`} onClick={() => generate(partner)}>{busyId === partner.id && busyLinkKind === "invite" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-4 h-4" />}</ActionButton>
                  <ActionButton className={`${iconButton} text-blue-600`} disabled={loading || !!busyId || partner.profileEditPending || partner.status !== "Active"} tooltip={partner.status === "Active" ? "Copy password reset link" : "Password recovery (active accounts only)"} label={`Copy password reset link for ${partner.email}`} onClick={() => generate(partner, "recovery")}>{busyId === partner.id && busyLinkKind === "recovery" ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}</ActionButton>
                  <ActionButton className={`${iconButton} ${partner.status === "Deactivated" ? "text-success" : "text-warning"}`} disabled={loading || !!busyId || partner.profileEditPending || (showingAdmins && (partner.id === currentUserId || (partner.status === "Active" && admins.filter((item) => item.status === "Active").length <= 1)))} tooltip={showingAdmins && partner.id === currentUserId ? "You cannot deactivate your own account" : partner.status === "Deactivated" ? "Reactivate user" : "Deactivate user"} label={`${partner.status === "Deactivated" ? "Reactivate" : "Deactivate"} user ${partner.email}`} onClick={() => setConfirmation({ partner, action: partner.status === "Deactivated" ? "enable" : "disable" })}>{partner.status === "Deactivated" ? <Play className="w-4 h-4" /> : <Power className="w-4 h-4" />}</ActionButton>
                  <ActionButton className={`${iconButton} text-danger`} disabled={loading || !!busyId || partner.profileEditPending || (showingAdmins && (partner.id === currentUserId || (partner.status === "Active" && admins.filter((item) => item.status === "Active").length <= 1)))} tooltip={showingAdmins && partner.id === currentUserId ? "You cannot delete your own account" : "Delete user"} label={`Delete user ${partner.email}`} onClick={() => setConfirmation({ partner, action: "delete" })}><Trash2 className="w-4 h-4" /></ActionButton>
                </div>
              </td>

            </tr>)}
            {!filtered.length && <tr><td colSpan={4} className="px-5 py-14 text-center"><Users className="w-8 h-8 mx-auto text-gray-300 mb-3" /><p className="font-medium text-gray-700">{loading ? "Loading users…" : error ? "User list unavailable" : users.length ? "No matching users" : showingAdmins ? "No administrators yet" : "No partners yet"}</p><p className="text-xs text-gray-500 mt-1">{loading ? "Please wait." : error ? "Try refreshing the user list." : users.length ? "Try another search or change the status filter." : showingAdmins ? "Add an administrator to generate an invitation link." : "Add your first partner to generate an invitation link."}</p></td></tr>}
          </tbody>
        </table></div>
        <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">{`${filtered.length} of ${users.length} ${showingAdmins ? "administrators" : "contacts"}`}</div>
      </section>
      {viewing && <PartnerDetails partner={viewing} onClose={() => setViewing(null)} />}
      {confirmation && <PartnerAccountConfirmation {...confirmation} onClose={() => setConfirmation(null)} onConfirm={changeAccount} />}
      {invitation && <InvitationLink result={invitation} onClose={() => setInvitation(null)} />}
      {editing && <PartnerEdit key={`${editing.id}:${editing.profileEditPending}`} partner={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {addingAdmin && <AddAdminDialog onClose={() => setAddingAdmin(false)} onCreated={async (result) => { setAddingAdmin(false); setActiveList("admins"); setQuery(""); setStatus("All statuses"); setInvitation(result); await refresh(); }} />}
      {inviting && <InviteDialog partners={partners} onClose={() => setInviting(false)} onInvite={invite} />}
    </div>
  );
}
