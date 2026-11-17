import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { loadReferralLink } from "../lib/referralForm";
export default function PartnerReferralLink() {
  const [state, setState] = useState({ loading: true, url: "", error: "" });
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    let active = true;
    loadReferralLink().then(url => { if (active) setState({ loading: false, url, error: "" }); })
      .catch(error => { if (active) setState({ loading: false, url: "", error: error.message }); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copy() {
    try { await navigator.clipboard.writeText(state.url); setCopied(true); setCopyError(""); }
    catch { setCopyError("Unable to copy automatically. Select and copy the link above."); }
  }
  return <section aria-label="Referral link" className="rounded-xl border border-gray-200/70 bg-white p-5">
    <h2 className="text-sm font-medium text-accent">Referral link</h2>
    <p className="mt-0.5 text-xs text-gray-500">Share your personal link with clients. Their submissions will appear under Referrals.</p>
    {state.loading && <p role="status" className="mt-3 text-sm text-gray-500">Loading your referral link…</p>}
    {state.error && <div className="mt-3 text-sm"><p role="alert" className="text-danger">{state.error}</p><button type="button" className="mt-2 font-medium text-accent" onClick={() => { setState({ loading: true, url: "", error: "" }); setAttempt(value => value + 1); }}>Try again</button></div>}
    {state.url && <div className="mt-3 flex items-center gap-2"><input aria-label="Your referral link" readOnly value={state.url} onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 font-mono text-xs focus:outline-accent" /><button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50">{copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button></div>}
    {copyError && <p role="alert" className="mt-2 text-xs text-danger">{copyError}</p>}
  </section>;
}
