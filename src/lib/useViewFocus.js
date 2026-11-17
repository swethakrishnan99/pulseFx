import { useLayoutEffect } from 'react';

/** Focus a new view before paint, so a delayed callback cannot steal the next Tab. */
export default function useViewFocus(view, selector = 'main') {
  useLayoutEffect(() => {
    if (document.querySelector('dialog')) return;
    const scope = document.querySelector(selector);
    const target = scope?.querySelector('[data-view-start], h1, h2') || scope;
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.setAttribute('data-view-focus', '');
    target.focus();
  }, [view, selector]);
}
