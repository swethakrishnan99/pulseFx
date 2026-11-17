import { dialogTabStops, keepDialogFocus } from "../lib/dialogFocus";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function PortalDialog({ onClose, children, title, subtitle, icon, maxWidth = "max-w-3xl", busy = false, closeOnBackdrop = false, collapseOnStatus = true }) {
  const dialog = useRef(null);
  const lastFocused = useRef(null);
  // Capture before child autoFocus runs during the commit that mounts the modal.
  const [previous] = useState(() => document.activeElement);
  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    const stops = dialogTabStops(element);
    const initial = stops.find(control => control.matches('[autofocus]'))
      || stops.find(control => control.matches('input, select, textarea')) || stops[0] || element;
    initial.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      // Sibling triggers may still be disabled until this commit finishes.
      queueMicrotask(() => {
        if (element.open) return; // StrictMode may already have reopened this dialog.
        const active = document.activeElement;
        if (active !== document.body && active?.isConnected && !element.contains(active)) return;
        if (previous?.isConnected && !previous.matches(':disabled')) previous.focus();
        else {
          const fallback = document.querySelector('dialog[open]') || document.querySelector('main h1, main');
          if (fallback) { fallback.setAttribute('tabindex', '-1'); fallback.focus(); }
        }
      });
    };
  }, [previous]);
  // Reconcile focus after success/error views or busy fieldsets replace a control.
  useEffect(() => {
    const element = dialog.current;
    const modals = [...document.querySelectorAll('dialog[open]')];
    if (!element?.open || modals.at(-1) !== element) return;
    const active = document.activeElement;
    if (element.contains(active) && !active.matches(':disabled')) return;
    // A pointer click on non-focusable content can leave focus on the body.
    // Repair only a removed/disabled control, not an intentional field blur.
    const last = lastFocused.current;
    if (last && element.contains(last) && !last.matches(':disabled')) return;
    const stops = dialogTabStops(element);
    const target = stops.find(control => control.matches('input, select, textarea'))
      || stops.find(control => control.closest('[role="status"]')) || stops[0] || element;
    target.focus({ preventScroll: true });
  });
  function requestClose() {
    if (busy || dialog.current?.querySelector('[aria-busy="true"]')) return;
    onClose();
  }
  return (
    <dialog ref={dialog} onFocusCapture={event => { lastFocused.current = event.target; }} tabIndex={-1} onKeyDown={keepDialogFocus} aria-label={title} onClick={event => { if (closeOnBackdrop && event.target === event.currentTarget) requestClose(); }} onCancel={event => { event.preventDefault(); requestClose(); }} className={`group relative m-auto max-h-[92dvh] w-[calc(100%-2rem)] ${maxWidth} ${collapseOnStatus ? "has-[[role=status]]:max-w-xl" : ""} overflow-y-auto rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-navy/60 backdrop:backdrop-blur-sm`}>
      <header className={`flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:px-8 ${collapseOnStatus ? "group-has-[[role=status]]:absolute group-has-[[role=status]]:right-3 group-has-[[role=status]]:top-3 group-has-[[role=status]]:border-0 group-has-[[role=status]]:p-0" : ""}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapseOnStatus ? "group-has-[[role=status]]:hidden" : ""}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent">{icon}</span>
          <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 break-words text-sm text-gray-500">{subtitle}</p>}</div>
        </div>
        <button type="button" disabled={busy} onClick={requestClose} aria-label={`Close ${title}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed"><X className="h-5 w-5" /></button>
      </header>
      {children}
    </dialog>
  );
}

