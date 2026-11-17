import { useEffect } from 'react';
import { movePageFocus } from '../lib/keyboardFocus';

/** Apply the same complete Tab sequence to every route, form and table. */
export default function KeyboardNavigation() {
  useEffect(() => {
    function onKeyDown(event) {
      const root = document.getElementById('root');
      if (!root || (event.target !== document.body && !root.contains(event.target))) return;
      // Native modal dialogs use their own wrapping sequence.
      if (document.querySelector('dialog[open]')) return;
      movePageFocus(event, root);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-navy px-4 py-2 text-sm text-white focus:translate-y-0"
    onClick={event => {
      const main = document.getElementById('main-content');
      if (!main) return;
      event.preventDefault(); main.setAttribute('tabindex', '-1'); main.focus();
    }}>Skip to main content</a>;
}
